// 本文件覆盖 SEC-01：渲染防线（D-09）。每个插进页面的状态值都必须按纯文本显示，没有脚本执行，也没有多出元素。
//
// 各条用例各自证明什么：
//  - SEC-01 with the entry checks bypassed ...：把入口检查（normalize）换成原样透传的内存变体，
//    用合成的恶意数据（记录文字、任务名、id、group、日期、力量当前值、力量历史数值）打开四个视图和两个编辑弹窗，
//    readInjection 都是干净的，恶意字符串原样出现在文字和属性值里。
//  - SEC-01 malicious text in plan group names ...：入口检查照常，只在内存里把 DEFAULT_PLAN 的七个字段
//    （组名、组说明、内置任务文字、力量名称和备注、基础预设、力量组说明）换成合成载荷，
//    四个视图、composer 的预设标签、两个编辑弹窗里它们只是文字（计划值本阶段没有外部入口，D-11，所以由变体放进来）。
//  - SEC-01 malicious text in every field ...：两道防线合在一起。不用任何变体，磁盘上的真实应用用合成恶意数据开局，
//    四个视图和两个编辑弹窗都干净，恶意文字原样显示，坏 id 和日期已被入口修正，保存的数据只含合格的 id 和日期、记录文字都在。
//  - SEC-01 the injection detector reports ...：反向对照。同样的恶意数据在关掉转义的变体上必须被检测到，
//    证明上面“干净”的结论不是因为检测器看不见。
//  - SEC-01 no state or plan value is interpolated ...：Node 侧的源码门槛，只防回归；转义是否生效由页面用例证明。
//
// 为什么用内存变体：入口检查会先把坏 id 和坏日期修掉，必须绕过它才看得到渲染防线本身。
// 变体只在内存里、用 page.route 只给这一个 page（见 tests/support/app-variant.ts），磁盘上的应用文件不变。
// 载荷只用合成文字，不发任何网络请求；检测靠 data-synth-xss 属性和多出来的元素，不靠 toggle 事件是否触发。
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '../../support/test';
import { editor } from '../../support/editor';
import { composer } from '../../support/composer';
import { serveAppVariant, BYPASS_NORMALIZE, DISABLE_ESCAPING, planValueEdit } from '../../support/app-variant';
import {
  CUR_PAYLOAD,
  CUSTOM_ID_PAYLOAD,
  DATE_ATTR_PAYLOAD,
  GROUP_PAYLOAD,
  HIST_PAYLOAD,
  ID_PAYLOAD,
  SCRIPT_PAYLOAD,
  DQ_PAYLOAD,
  TAG_PAYLOAD,
  maliciousPlanValues,
  maliciousState,
} from '../../fixtures/malicious-state';
import { loadFixture } from '../../support/fixture-files';
import { APP_FILE_NAME, FROZEN_TODAY } from '../../support/constants';
import { CAT_LANGUAGE, GROUP_UNKNOWN_LABEL, TAB_LABELS } from '../../support/strings';

type Injection = { flag: number; marked: number; foreign: number; handlers: number; scripts: number };

// 注入检测器：window.__synthXss 的值（缺省为 0）、带 data-synth-xss 的元素数、
// s / details / img / iframe / svg / object / embed 元素数、带任何 on 开头属性的元素数、document.scripts.length。
// 应用本身没有这些元素，只有一个脚本，所以“干净”就是前四项为 0、scripts 为 1。
async function readInjection(page: Page): Promise<Injection> {
  return page.evaluate(() => ({
    flag: Number((window as unknown as { __synthXss?: number }).__synthXss || 0),
    marked: document.querySelectorAll('[data-synth-xss]').length,
    foreign: document.querySelectorAll('s, details, img, iframe, svg, object, embed').length,
    handlers: Array.from(document.querySelectorAll('*')).filter((el) =>
      Array.from(el.attributes).some((a) => a.name.startsWith('on')),
    ).length,
    scripts: document.scripts.length,
  }));
}

async function expectClean(page: Page, where: string) {
  expect(await readInjection(page), `${where}：有脚本执行或多出了元素`).toEqual({
    flag: 0,
    marked: 0,
    foreign: 0,
    handlers: 0,
    scripts: 1,
  });
}

async function openTab(page: Page, key: keyof typeof TAB_LABELS) {
  const tab = page.getByRole('tab', { name: TAB_LABELS[key], exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// 按 dataset 匹配元素再 click，载荷不拼进选择器
async function clickByDataset(page: Page, scope: string, attr: 'edit' | 'edittask', value: string) {
  const found = await page.evaluate(
    ({ scope, attr, value }) => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(`${scope} [data-${attr}]`)).find(
        (e) => e.dataset[attr] === value,
      );
      if (!el) return false;
      el.click();
      return true;
    },
    { scope, attr, value },
  );
  expect(found, `没有找到 data-${attr} 匹配的元素`).toBe(true);
}

test('SEC-01 with the entry checks bypassed every renderer still escapes ids, dates and values', async ({
  page,
  app,
}) => {
  await serveAppVariant(page, [BYPASS_NORMALIZE]);
  await app.open({ mode: 'account', seed: maliciousState() });
  await app.expectAccountMode();

  // 四个视图
  await expectClean(page, '本周');
  await openTab(page, 'cal');
  await page.locator(`#grid [data-date="${FROZEN_TODAY}"]`).click();
  await expectClean(page, '日历');
  await openTab(page, 'goal');
  await expectClean(page, '目标');
  await openTab(page, 'tl');
  await expectClean(page, '时间线');

  // 文字和属性值原样往返（布尔）
  const roundTrip = await page.evaluate(
    (p) => {
      const all = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
      return {
        weekText: all('#days .ent span').some((e) => e.textContent === p.tag),
        editId: all<HTMLElement>('[data-edit]').some((e) => e.dataset.edit === p.id),
        taskId: all<HTMLElement>('[data-task]').some((e) => e.dataset.task === p.cid),
        liftCur: document.querySelector('#lf-bench')?.getAttribute('value') === p.cur,
        due: all<HTMLElement>('input[data-due]').some((e) => e.dataset.due === 'c-synth-1' && e.getAttribute('value') === p.date),
        // 组 id 不再作为文字进入页面（D-14）：找不到组的待办显示「未知目标组」，载荷不出现在任何标签里
        group: all('#dayPanel .tag').some((e) => e.textContent === p.unknown) && !all('#dayPanel .tag').some((e) => (e.textContent || '').includes(p.group)),
        hist: all('.hist').some((e) => (e.textContent || '').includes(p.hist)),
      };
    },
    { tag: TAG_PAYLOAD, id: ID_PAYLOAD, cid: CUSTOM_ID_PAYLOAD, cur: CUR_PAYLOAD, date: DATE_ATTR_PAYLOAD, group: GROUP_PAYLOAD, unknown: GROUP_UNKNOWN_LABEL, hist: HIST_PAYLOAD },
  );
  expect(roundTrip, '恶意字符串没有原样出现在文字或属性值里').toEqual({
    weekText: true,
    editId: true,
    taskId: true,
    liftCur: true,
    due: true,
    group: true,
    hist: true,
  });

  // 两个编辑弹窗：日期载荷那条记录、doneDate 载荷那条完成计划，都从时间线打开
  const ed = editor(page);
  await clickByDataset(page, '#timeline', 'edit', 'synth-log-4');
  await ed.expectOpen();
  await expectClean(page, '记录编辑弹窗');
  expect(await page.locator('#ed-date').getAttribute('value'), '记录弹窗的日期框 value 属性').toBe(DATE_ATTR_PAYLOAD);
  await page.keyboard.press('Escape');
  await ed.expectClosed();

  await clickByDataset(page, '#timeline', 'edittask', 'c-synth-4');
  await ed.expectOpen();
  await expectClean(page, '完成计划弹窗');
  expect(await page.locator('#ed-date').getAttribute('value'), '完成计划弹窗的日期框 value 属性').toBe(DATE_ATTR_PAYLOAD);
  await page.keyboard.press('Escape');
  await ed.expectClosed();
});

// 目标视图等处：不含子元素的元素的文字包含载荷。scope 是固定的选择器，载荷只作为参数传入
async function hasLeafText(page: Page, scope: string, needle: string): Promise<boolean> {
  return page.evaluate(
    ({ scope, needle }) =>
      Array.from(document.querySelectorAll(`${scope} *`)).some(
        (e) => e.children.length === 0 && (e.textContent || '').includes(needle),
      ),
    { scope, needle },
  );
}

test('SEC-01 malicious text in plan group names, task names, lift fields and base presets renders as plain text in the four views, the composer and both editors', async ({
  page,
  app,
}) => {
  const planValues = maliciousPlanValues();
  const val = (p: string): string => {
    const found = planValues.find((x) => x.path === p);
    if (!found) throw new Error(`没有这个计划字段的载荷：${p}`);
    return found.value;
  };
  const taskText = val('groups[0].tasks[0].text');

  // 入口检查照常，只在内存里改 DEFAULT_PLAN 的七个字段
  await serveAppVariant(page, [planValueEdit(planValues)]);
  const seed = loadFixture('full-state.json');
  seed.tasks['P1-1'] = { done: true, doneDate: FROZEN_TODAY };
  // 没有力量历史时才显示力量备注
  delete seed.lifts.bench;
  seed.logs.push({ id: 'synth-plan-log', date: FROZEN_TODAY, cat: CAT_LANGUAGE, text: 'SYNTH plan value record' });
  await app.open({ mode: 'account', seed });
  await app.expectAccountMode();

  // 四个视图都干净，P1-1 的任务文字载荷出现在本周、日面板、时间线
  await expectClean(page, '本周');
  expect(await hasLeafText(page, '#tab-wk', taskText), '本周视图里没有字段 groups[0].tasks[0].text 的载荷文字').toBe(true);

  await openTab(page, 'cal');
  await page.locator(`#grid [data-date="${FROZEN_TODAY}"]`).click();
  await expectClean(page, '日历');
  expect(await hasLeafText(page, '#dayPanel', taskText), '日面板里没有字段 groups[0].tasks[0].text 的载荷文字').toBe(true);

  await openTab(page, 'goal');
  await expectClean(page, '目标');
  for (const field of ['groups[0].name', 'groups[1].note', 'groups[0].tasks[0].text', 'lifts[0].n', 'lifts[0].note', 'fitNote']) {
    expect(await hasLeafText(page, '#goals', val(field)), `目标视图里没有字段 ${field} 的载荷文字`).toBe(true);
  }

  await openTab(page, 'tl');
  await expectClean(page, '时间线');
  expect(await hasLeafText(page, '#timeline', taskText), '时间线里没有字段 groups[0].tasks[0].text 的载荷文字').toBe(true);

  // 回到本周：composer 切到语言类别，预设标签干净，预设载荷原样往返
  await openTab(page, 'wk');
  const picked = await page.evaluate((ccat) => {
    const b = Array.from(document.querySelectorAll<HTMLElement>('#wkComp [data-ccat]')).find((x) => x.dataset.ccat === ccat);
    if (!b) return false;
    b.click();
    return true;
  }, `w|${CAT_LANGUAGE}`);
  expect(picked, '没有找到语言类别按钮').toBe(true);
  await expectClean(page, 'composer');
  const presetOk = await page.evaluate(
    (v) =>
      Array.from(document.querySelectorAll<HTMLElement>('#wkComp button[data-preset]')).some(
        (b) => (b.textContent || '').includes(v) && (b.dataset.preset || '').split('|').slice(1).join('|') === v,
      ),
    val('presets.lang[0]'),
  );
  expect(presetOk, 'composer 里没有字段 presets.lang[0] 的预设标签，或属性没有原样往返').toBe(true);

  // 两个编辑弹窗：合成记录、完成的 P1-1
  const ed = editor(page);
  await clickByDataset(page, '#tab-wk', 'edit', 'synth-plan-log');
  await ed.expectOpen();
  await expectClean(page, '记录编辑弹窗');
  await page.keyboard.press('Escape');
  await ed.expectClosed();

  await clickByDataset(page, '#tab-wk', 'edittask', 'P1-1');
  await ed.expectOpen();
  await expectClean(page, '完成计划弹窗');
  // 弹窗里的任务行除了组号标签没有别的子元素
  const dialogOk = await page.evaluate(
    (v) =>
      Array.from(document.querySelectorAll('#ed-form .ed-task')).some(
        (e) => e.childElementCount === 1 && (e.textContent || '').includes(v),
      ),
    taskText,
  );
  expect(dialogOk, '完成计划弹窗里没有字段 groups[0].tasks[0].text 的载荷文字').toBe(true);
  await page.keyboard.press('Escape');
  await ed.expectClosed();
});

// 两道防线合在一起：磁盘上的真实应用，没有任何内存变体。入口检查先修正坏 id 和坏日期，渲染转义再把恶意文字当纯文本显示。
// 期望值都在本用例里独立写出（id 和日期的格式不从应用里取）。
test('SEC-01 malicious text in every field renders as plain text in the four views and both editors', async ({
  page,
  app,
}) => {
  const bad = maliciousState();
  await app.open({ mode: 'account', seed: bad });
  await app.expectAccountMode();

  // 本周：标签注入原样出现在条目文字里，复盘文本框的值原样往返，坏 id 已被修正
  await expectClean(page, '本周');
  const week = await page.evaluate(
    (p) => ({
      tagText: Array.from(document.querySelectorAll('#days .ent span')).some((e) => e.textContent === p.tag),
      scriptText: Array.from(document.querySelectorAll('#days .ent span')).some((e) => e.textContent === p.script),
      review: (document.getElementById('review') as HTMLTextAreaElement | null)?.value === p.tag,
      badEditId: Array.from(document.querySelectorAll<HTMLElement>('[data-edit]')).some((e) => e.dataset.edit === p.id),
    }),
    { tag: TAG_PAYLOAD, script: SCRIPT_PAYLOAD, id: ID_PAYLOAD },
  );
  expect(week, '本周视图：恶意文字没有原样显示，或坏 id 还在页面上').toEqual({
    tagText: true,
    scriptText: true,
    review: true,
    badEditId: false,
  });

  // 日历：点开今天的日面板
  await openTab(page, 'cal');
  await page.locator(`#grid [data-date="${FROZEN_TODAY}"]`).click();
  await expectClean(page, '日历');

  // 目标：双引号载荷是那条待办的文字，坏的待办 id 已被修正
  await openTab(page, 'goal');
  await expectClean(page, '目标');
  expect(await hasLeafText(page, '#goals', DQ_PAYLOAD), '目标视图里没有双引号载荷的待办文字').toBe(true);
  expect(
    await page.evaluate(
      (cid) => Array.from(document.querySelectorAll<HTMLElement>('[data-task]')).some((e) => e.dataset.task === cid),
      CUSTOM_ID_PAYLOAD,
    ),
    '目标视图：坏的待办 id 还在页面上',
  ).toBe(false);

  // 时间线
  await openTab(page, 'tl');
  await expectClean(page, '时间线');

  // 回到本周：语言类别的预设标签里有标签注入载荷（用户预设原样往返）
  await openTab(page, 'wk');
  const picked = await page.evaluate((ccat) => {
    const b = Array.from(document.querySelectorAll<HTMLElement>('#wkComp [data-ccat]')).find((x) => x.dataset.ccat === ccat);
    if (!b) return false;
    b.click();
    return true;
  }, `w|${CAT_LANGUAGE}`);
  expect(picked, '没有找到语言类别按钮').toBe(true);
  await expectClean(page, 'composer');
  const presetOk = await page.evaluate(
    (v) =>
      Array.from(document.querySelectorAll<HTMLElement>('#wkComp button[data-preset]')).some(
        (b) => b.textContent === v && (b.dataset.preset || '').split('|').slice(1).join('|') === v,
      ),
    TAG_PAYLOAD,
  );
  expect(presetOk, '语言类别的预设标签里没有标签注入载荷，或属性没有原样往返').toBe(true);

  // 两个编辑弹窗：标签注入那条记录、今天完成的那条自定义待办
  const ed = editor(page);
  await clickByDataset(page, '#tab-wk', 'edit', 'synth-log-1');
  await ed.expectOpen();
  await expectClean(page, '记录编辑弹窗');
  await page.keyboard.press('Escape');
  await ed.expectClosed();

  await clickByDataset(page, '#tab-wk', 'edittask', 'c-synth-3');
  await ed.expectOpen();
  await expectClean(page, '完成计划弹窗');
  await page.keyboard.press('Escape');
  await ed.expectClosed();

  // 记一条哨兵触发保存：保存的记录 id 和日期全部合格，五条记录的文字都在，待办 id 都以 c- 开头
  const SENTINEL = 'SYNTH combined defenses sentinel';
  const comp = composer(page, 'w');
  await comp.type(SENTINEL);
  await comp.submit();
  const expectedTexts = [
    TAG_PAYLOAD,
    SCRIPT_PAYLOAD,
    'SYNTH log with an id payload',
    'SYNTH log with a date attribute payload',
    'SYNTH log with a date tag payload',
  ];
  await app.expectSaved((s) => s.logs.some((l: { text: string }) => l.text === SENTINEL));
  const saved = await app.saved();
  const logs: { id: string; date: string; text: string }[] = saved.logs;
  const idOk = /^[A-Za-z0-9_-]{1,64}$/;
  const dateOk = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  expect(
    logs.every((l) => idOk.test(l.id) && dateOk.test(l.date)),
    '保存的记录里还有不合格的 id 或日期',
  ).toBe(true);
  expect(
    expectedTexts.every((t) => logs.some((l) => l.text === t)),
    '保存的记录里少了合成记录的文字',
  ).toBe(true);
  expect(logs.length, '保存的记录条数').toBe(expectedTexts.length + 1);
  expect(
    saved.custom.every((c: { id: string }) => /^c-[A-Za-z0-9_-]{1,60}$/.test(c.id)),
    '保存的待办里还有不以 c- 开头的 id',
  ).toBe(true);
  expect(saved.custom.length, '保存的待办条数').toBe(bad.custom.length);
  await expectClean(page, '保存之后');
});

test('SEC-01 the injection detector reports elements injected by a variant without escaping', async ({ page, app }) => {
  await serveAppVariant(page, [BYPASS_NORMALIZE, DISABLE_ESCAPING]);
  await app.open({ mode: 'account', seed: maliciousState() });
  await app.expectAccountMode();

  // 关掉转义后，同样的数据会多出元素和带标记的属性：检测器必须看得到
  await expect
    .poll(
      async () => {
        const r = await readInjection(page);
        return r.foreign + r.marked;
      },
      { message: '关掉转义的变体上检测器没有看到任何注入' },
    )
    .toBeGreaterThan(0);

  const seen = await readInjection(page);
  // details 的 toggle 事件是否触发不作为断言，只把现象记下来
  test.info().annotations.push({
    type: 'note',
    description: `detector on the unescaped variant: flag=${seen.flag} marked=${seen.marked} foreign=${seen.foreign} handlers=${seen.handlers} scripts=${seen.scripts}`,
  });
});

// 源码门槛：每一条都是紧跟右花括号的完整插值，例如 ${L.unit==="kg"?2.5:1} 这种算出数字的写法不在其中。
// 清单与转义清单逐项对应：记录和任务的 id、group、due、doneDate、记录日期、力量字段（含力量历史的数值）、
// 组字段、周目标、力量组说明、类别名和筛选项。
const BARE_TOKENS = [
  'l.id',
  'x.id',
  't.id',
  't.group',
  's.cur',
  'g.p',
  'g.id',
  'g.name',
  'g.note',
  'L.n',
  'L.target',
  'L.unit',
  'L.id',
  'L.note',
  'plan.fitGoal[0]',
  'plan.fitGoal[1]',
  'plan.fitNote',
  'mm.slice(0,4)',
  's.due||""',
  's.doneDate||today()',
  'form.dataset.kdate||l.date',
  'c.n',
  'C.n',
  'o',
  'x.v',
];
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BARE_PATTERNS: RegExp[] = [
  ...BARE_TOKENS.map((t) => new RegExp(`\\$\\{${literal(t)}\\}`, 'g')),
  // 三元表达式结尾的备注
  /:L\.note\}/g,
];

function bareInterpolations(html: string): string[] {
  const found: string[] = [];
  for (const re of BARE_PATTERNS) {
    for (const m of html.matchAll(re)) {
      const at = m.index ?? 0;
      found.push(html.slice(Math.max(0, at - 30), at + m[0].length + 30).replace(/\s+/g, ' '));
    }
  }
  return found;
}

// 这道门槛只防回归；转义是否生效由上面的页面用例证明。对照：把应用里的 ${esc(X)} 改回 ${X} 之后门槛必须报出匹配
test('SEC-01 no state or plan value is interpolated into the app markup without esc', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', APP_FILE_NAME), 'utf8');
  expect(bareInterpolations(html), '应用里还有没包 esc() 的插值（下面是匹配到的源码片段）').toEqual([]);

  const unescaped = html.replace(/\$\{esc\((.*?)\)\}/g, '${$1}');
  expect(bareInterpolations(unescaped).length, '对照：去掉 esc 之后门槛应当报出匹配').toBeGreaterThan(0);
});
