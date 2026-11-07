// 本文件覆盖 SEC-01：渲染防线（D-09）。每个插进页面的状态值都必须按纯文本显示，没有脚本执行，也没有多出元素。
//
// 各条用例各自证明什么：
//  - SEC-01 with the entry checks bypassed ...：把入口检查（normalize）换成原样透传的内存变体，
//    用合成的恶意数据（记录文字、任务名、id、group、日期、力量当前值、力量历史数值）打开四个视图和两个编辑弹窗，
//    readInjection 都是干净的，恶意字符串原样出现在文字和属性值里。
//
// 为什么用内存变体：入口检查会先把坏 id 和坏日期修掉，必须绕过它才看得到渲染防线本身。
// 变体只在内存里、用 page.route 只给这一个 page（见 tests/support/app-variant.ts），磁盘上的应用文件不变。
// 载荷只用合成文字，不发任何网络请求；检测靠 data-synth-xss 属性和多出来的元素，不靠 toggle 事件是否触发。
import { test, expect, type Page } from '../../support/test';
import { editor } from '../../support/editor';
import { serveAppVariant, BYPASS_NORMALIZE } from '../../support/app-variant';
import {
  CUR_PAYLOAD,
  CUSTOM_ID_PAYLOAD,
  DATE_ATTR_PAYLOAD,
  GROUP_PAYLOAD,
  HIST_PAYLOAD,
  ID_PAYLOAD,
  TAG_PAYLOAD,
  maliciousState,
} from '../../fixtures/malicious-state';
import { FROZEN_TODAY } from '../../support/constants';
import { TAB_LABELS } from '../../support/strings';

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
        group: all('#dayPanel .tag').some((e) => e.textContent === p.group),
        hist: all('.hist').some((e) => (e.textContent || '').includes(p.hist)),
      };
    },
    { tag: TAG_PAYLOAD, id: ID_PAYLOAD, cid: CUSTOM_ID_PAYLOAD, cur: CUR_PAYLOAD, date: DATE_ATTR_PAYLOAD, group: GROUP_PAYLOAD, hist: HIST_PAYLOAD },
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
