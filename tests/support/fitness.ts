// 健身页用例的共用操作和读回（Phase 15）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 隐私（D-05）：只读合成数据；一次 page.evaluate 读回布尔、数值和固定界面文案，
// 不返回元素句柄，也不把计划文字带回 Node（动作名只在页面里和期望值做相等比较，由调用方决定要不要比较）。
import { expect, type Page } from '@playwright/test';
import { TAB_LABELS } from './strings';

// 打开健身标签并等记录区出现
export async function gotoFitness(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.fit, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-fit')).toBeVisible();
}

// 点「＋ 动作名」芯片，把力量项 id 对应的动作块加进这次训练
export async function flAddLift(page: Page, id: string) {
  await page.locator(`[data-fl-add="lift:${id}"]`).click();
  await expect(page.locator(`.fl-ex[data-lift="${id}"]`)).toBeVisible();
}

// 填第 j 组（从 0 数）的重量和次数
export async function flFillSet(page: Page, id: string, j: number, w: string, r: string) {
  await page.locator(`#fl-w-${id}-${j}`).fill(w);
  await page.locator(`#fl-r-${id}-${j}`).fill(r);
}

// 点保存按钮
export async function flSave(page: Page) {
  await page.locator('#fl-save').click();
}

export type WeekWoRead = { text: string; draggable: boolean; edit: boolean };

// 读本周页某一天的训练行（.ent.wo[data-wo=<日期>]）：文字、是否可拖动、是否带 data-edit；没有这一行返回 null
export async function readWeekWo(page: Page, date: string): Promise<WeekWoRead | null> {
  return page.evaluate((d) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('#days .ent.wo')).find((x) => x.dataset.wo === d);
    if (!el) return null;
    const first = el.querySelector('span');
    return {
      text: first ? (first.textContent ?? '') : '',
      draggable: el.hasAttribute('draggable') && el.getAttribute('draggable') !== 'false',
      edit: el.hasAttribute('data-edit'),
    };
  }, date);
}

// 已保存 state 里的 workouts（JSON 往返，没有这个键就是空对象）
export function savedWorkouts(state: any): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state?.workouts ?? {}));
}

// ---- Phase 15-02：记录区的共用操作 ----

// 点某个动作块的「复制上一组」
export async function flCopySet(page: Page, id: string) {
  await page.locator(`.fl-ex[data-lift="${id}"] [data-flact="copyset"]`).click();
}

// 第 j 组（从 0 数）的错误行是否可见，并且文字等于 expected（只返回布尔，不把文字带回 Node）
export async function flError(page: Page, id: string, j: number, expected: string): Promise<boolean> {
  return page.evaluate(
    ([i, n, t]) => {
      const el = document.getElementById(`fl-e-${i}-${n}`);
      return !!el && !el.hidden && el.textContent === t;
    },
    [id, String(j), expected] as const,
  );
}

export type FlRead = { id: string; sets: Array<{ w: string; r: string }> };

// 读回记录区里每个力量动作块：id 和每组两个输入框的值（只对合成或示例 id）
export async function readFl(page: Page): Promise<FlRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#fl .fl-ex')).map((bx) => ({
      id: bx.dataset.lift ?? '',
      sets: Array.from(bx.querySelectorAll<HTMLElement>('.fl-set')).map((li) => {
        const ins = li.querySelectorAll<HTMLInputElement>('input');
        return { w: ins[0]?.value ?? '', r: ins[1]?.value ?? '' };
      }),
    })),
  );
}

// 点芯片，把有氧项 id 对应的有氧行加进这次训练
export async function flAddCardio(page: Page, id: string) {
  await page.locator(`[data-fl-add="cardio:${id}"]`).click();
  await expect(page.locator(`.fl-cd[data-cardio="${id}"]`)).toBeVisible();
}

// 填有氧行的时长，距离留空就不传
export async function flFillCardio(page: Page, id: string, m: string, d?: string) {
  await page.locator(`#fl-m-${id}`).fill(m);
  if (d !== undefined) await page.locator(`#fl-d-${id}`).fill(d);
}

// 点某个动作块第 j 组（从 0 数）的「删除」
export async function flDeleteSet(page: Page, id: string, j: number) {
  await page.locator(`.fl-ex[data-lift="${id}"] .fl-set`).nth(j).locator('[data-flact="delset"]').click();
}

// 点某个动作块的「移除这个动作」
export async function flRemoveEx(page: Page, id: string) {
  await page.locator(`.fl-ex[data-lift="${id}"] [data-flact="rmex"]`).click();
}

// 芯片行里每个芯片的 data-fl-add（lift:<id> / cardio:<id>）
export async function flChipIds(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('#fl [data-fl-add]')).map((b) => b.dataset.flAdd ?? ''));
}

export type ChartPt = { date: string; v: string; old: boolean; cx: number };
export type ChartRead = {
  lift: string;
  mode: string;
  sub: string;
  pts: ChartPt[];
  linePairs: number; // .fc-ln 的 points 有几对坐标，没有折线是 0
  target: boolean;
  dash: string | null; // .fc-tgt 的 stroke-dasharray 属性
  targetText: string; // .fc-tl 的文字，没有是空串
  read: string;
  aria: string;
  role: string | null;
  vbW: number; // viewBox 宽度，没有 svg 是 0
  cw: number; // svg 的 clientWidth，没有 svg 是 0
  empty: string | null; // .fc-empty 的文字，没有是 null
  emptyH: number; // .fc-empty 的高度，没有是 0
  notes: string[]; // .fc-leg 的文字（含 .fc-once）
  hasLegend: boolean; // 有没有不带 .fc-once 的 .fc-leg
  hasOnce: boolean;
  rows: number; // 查看数据表格的行数，没有表格是 0
  firstRow: string; // 表格第一行的文字（单元格用「|」连），没有是空串
  tableHeads: string[];
  sources: string[]; // 表格每行的来源列
  styled: number; // 这张图里带 style 属性的元素个数
};

// 一次 evaluate 读回每张折线图（figure.fc[data-lift]，不含有氧柱形图）；只对示例和合成 id，不返回元素句柄（15-03）
export async function readCharts(page: Page): Promise<ChartRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#fc figure.fc[data-lift]')).map((fig) => {
      const svg = fig.querySelector<SVGSVGElement>('svg.fc-svg');
      const emp = fig.querySelector<HTMLElement>('.fc-empty');
      const ln = fig.querySelector('.fc-ln');
      const tgt = fig.querySelector('.fc-tgt');
      const rows = Array.from(fig.querySelectorAll('.fc-data tbody tr'));
      const legs = Array.from(fig.querySelectorAll('.fc-leg'));
      return {
        lift: fig.dataset.lift ?? '',
        mode: fig.dataset.mode ?? '',
        sub: fig.querySelector('.fc-metric')?.textContent ?? '',
        pts: Array.from(fig.querySelectorAll('.fc-pt')).map((c) => ({
          date: c.getAttribute('data-date') ?? '',
          v: c.getAttribute('data-v') ?? '',
          old: c.classList.contains('old'),
          cx: parseFloat(c.getAttribute('cx') ?? 'NaN'),
        })),
        linePairs: ln ? (ln.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).length : 0,
        target: !!tgt,
        dash: tgt ? tgt.getAttribute('stroke-dasharray') : null,
        targetText: fig.querySelector('.fc-tl')?.textContent ?? '',
        read: fig.querySelector('.fc-read')?.textContent ?? '',
        aria: svg?.getAttribute('aria-label') ?? '',
        role: svg ? svg.getAttribute('role') : null,
        vbW: svg ? Math.round(svg.viewBox.baseVal.width) : 0,
        cw: svg ? Math.round(svg.clientWidth) : 0,
        empty: emp ? (emp.textContent ?? '') : null,
        emptyH: emp ? Math.round(emp.getBoundingClientRect().height) : 0,
        notes: legs.map((x) => x.textContent ?? ''),
        hasLegend: legs.some((x) => !x.classList.contains('fc-once')),
        hasOnce: legs.some((x) => x.classList.contains('fc-once')),
        rows: rows.length,
        firstRow: rows[0] ? Array.from(rows[0].querySelectorAll('td')).map((x) => x.textContent ?? '').join('|') : '',
        tableHeads: Array.from(fig.querySelectorAll('.fc-data thead th')).map((x) => x.textContent ?? ''),
        sources: rows.map((r) => r.querySelectorAll('td')[2]?.textContent ?? ''),
        styled: fig.querySelectorAll('[style]').length + (fig.hasAttribute('style') ? 1 : 0),
      };
    }),
  );
}

// #fc 里带 style 属性的元素个数（含面板自己和 svg 子元素）
export async function fcStyled(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('#fc [style]').length + (document.getElementById('fc')?.hasAttribute('style') ? 1 : 0));
}

// 点指标芯片（max | e1rm | vol）
export async function setMetric(page: Page, metric: string) {
  await page.locator(`#fc [data-fc-metric="${metric}"]`).click();
  await expect(page.locator(`#fc [data-fc-metric="${metric}"]`)).toHaveAttribute('aria-pressed', 'true');
}

// 点时间范围芯片（1m | 3m | 6m | 1y | all）
export async function setRange(page: Page, range: string) {
  await page.locator(`#fc [data-fc-range="${range}"]`).click();
  await expect(page.locator(`#fc [data-fc-range="${range}"]`)).toHaveAttribute('aria-pressed', 'true');
}

export type PagerRead = {
  present: boolean; // 有没有翻页器
  page: string; // #fc-page 的文字
  prevDisabled: boolean;
  nextDisabled: boolean;
  focused: string; // 当前焦点的 id（不在 #fc 里是空串）
  live: string; // #fc-live 的文字
  lifts: string[]; // 当前页每张图的 data-lift
  cols: number; // .fc-grid 的列数
};

// 读翻页器和当前页的图（一次 evaluate，只返回文字、布尔和数）
export async function readPager(page: Page): Promise<PagerRead> {
  return page.evaluate(() => {
    const prev = document.getElementById('fcPrev') as HTMLButtonElement | null;
    const next = document.getElementById('fcNext') as HTMLButtonElement | null;
    const grid = document.querySelector('#fc .fc-grid');
    const ae = document.activeElement as HTMLElement | null;
    return {
      present: !!document.querySelector('#fc .fc-pager'),
      page: document.getElementById('fc-page')?.textContent ?? '',
      prevDisabled: !!prev?.disabled,
      nextDisabled: !!next?.disabled,
      focused: ae && document.getElementById('fc')?.contains(ae) ? ae.id : '',
      live: document.getElementById('fc-live')?.textContent ?? '',
      lifts: Array.from(document.querySelectorAll<HTMLElement>('#fc figure.fc[data-lift]')).map((x) => x.dataset.lift ?? ''),
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
    };
  });
}

export type CardioRead = {
  present: boolean; // 有没有每周有氧卡片
  title: string;
  note: string;
  bars: Array<{ week: string; v: string; h: number }>;
  read: string;
  aria: string;
  empty: string | null;
  emptyH: number;
  rows: number;
  heads: string[];
  vbW: number;
  cw: number;
  styled: number;
};

// 读每周有氧总时长卡片（figure.fc-cd）：没有这张卡返回 present=false
export async function readCardioChart(page: Page): Promise<CardioRead> {
  return page.evaluate(() => {
    const fig = document.querySelector<HTMLElement>('#fc figure.fc-cd');
    const svg = fig?.querySelector<SVGSVGElement>('svg.fc-svg') ?? null;
    const emp = fig?.querySelector<HTMLElement>('.fc-empty') ?? null;
    return {
      present: !!fig,
      title: fig?.querySelector('.fc-name')?.textContent ?? '',
      note: fig?.querySelector('.fc-mnote')?.textContent ?? '',
      bars: Array.from(fig?.querySelectorAll('rect.fc-bar') ?? []).map((r) => ({
        week: r.getAttribute('data-week') ?? '',
        v: r.getAttribute('data-v') ?? '',
        h: parseFloat(r.getAttribute('height') ?? 'NaN'),
      })),
      read: fig?.querySelector('.fc-read')?.textContent ?? '',
      aria: svg?.getAttribute('aria-label') ?? '',
      empty: emp ? (emp.textContent ?? '') : null,
      emptyH: emp ? Math.round(emp.getBoundingClientRect().height) : 0,
      rows: fig?.querySelectorAll('.fc-data tbody tr').length ?? 0,
      heads: Array.from(fig?.querySelectorAll('.fc-data thead th') ?? []).map((x) => x.textContent ?? ''),
      vbW: svg ? Math.round(svg.viewBox.baseVal.width) : 0,
      cw: svg ? Math.round(svg.clientWidth) : 0,
      styled: fig ? fig.querySelectorAll('[style]').length : 0,
    };
  });
}

// 读某张图的指针状态：读数行、竖线 x1、各点的 r（data-date → r）
export async function readPointer(page: Page, lift: string) {
  return page.evaluate((id) => {
    const fig = document.querySelector(`#fc figure.fc[data-lift="${id}"]`);
    const sl = fig?.querySelector('.fc-sel-l');
    return {
      read: fig?.querySelector('.fc-read')?.textContent ?? '',
      selX: sl ? parseFloat(sl.getAttribute('x1') ?? 'NaN') : NaN,
      radii: Object.fromEntries(Array.from(fig?.querySelectorAll('.fc-pt') ?? []).map((c) => [c.getAttribute('data-date') ?? '', c.getAttribute('r') ?? ''])),
    };
  }, lift);
}

// 本机留底（usj:v2:<用户 id>:wodraft）：在页面里按后缀找键，只返回有没有和留底里的日期，不把草稿内容带回 Node
export async function hasWoDraft(page: Page): Promise<{ has: boolean; date: string | null }> {
  return page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('usj:v2:') && x.endsWith(':wodraft'));
    if (!k) return { has: false, date: null };
    try {
      const o = JSON.parse(localStorage.getItem(k) ?? 'null');
      return { has: true, date: typeof o?.date === 'string' ? o.date : null };
    } catch {
      return { has: true, date: null };
    }
  });
}

// ---- Phase 15-04：本周训练和力量目标面板（#fw）的读回 ----

export type LiftGoalRead = {
  lift: string | null; // data-lift，只在属于 ids 时返回，否则 null
  value: string | null; // .fw-lv 里单位之前的文字（当前值，原样）；只对 lift 不为 null 的卡返回
  unit: string | null; // .fw-lv small 的文字（带前导空格），同上
  target: string | null; // .fw-tg 的文字，同上
  dataW: number | null; // 进度条 i 的 data-w（未取整的百分比）
  width: string | null; // 进度条 i 的 style.width（CSSOM 赋值的结果，如 100%）
  now: string | null; // 进度条的 aria-valuenow
  captions: string[] | null; // 全部 .fw-cap 的文字（百分比行、最近一次训练或还没有训练记录、徒手行、备注），同上
};

// 一次 evaluate 读回健身页的力量目标卡（#tab-fit .fw-lift，按 DOM 顺序，每一张都在）。
// lift 只在属于 ids 时返回，其余卡的 id、名称、备注都不带回 Node（隐私：只对示例和合成计划返回文字）。
export async function readLiftGoals(page: Page, ids: readonly string[]): Promise<LiftGoalRead[]> {
  return page.evaluate((idList) => {
    return Array.from(document.querySelectorAll<HTMLElement>('#tab-fit .fw-lift')).map((card) => {
      const id = card.dataset.lift ?? '';
      const ok = idList.includes(id);
      const bar = card.querySelector<HTMLElement>('.fw-bar i');
      const small = card.querySelector('.fw-lv small');
      return {
        lift: ok ? id : null,
        value: ok ? (card.querySelector('.fw-lv')?.firstChild?.textContent ?? '') : null,
        unit: ok ? (small?.textContent ?? '') : null,
        target: ok ? (card.querySelector('.fw-tg')?.textContent ?? '') : null,
        dataW: bar ? parseFloat(bar.getAttribute('data-w') ?? 'NaN') : null,
        width: bar ? bar.style.width : null,
        now: card.querySelector('.fw-bar')?.getAttribute('aria-valuenow') ?? null,
        captions: ok ? Array.from(card.querySelectorAll('.fw-cap')).map((x) => x.textContent ?? '') : null,
      };
    });
  }, [...ids]);
}

export type FitWeekRead = {
  n: string; // .fw-n
  goal: string; // .fw-goal
  ok: string | null; // .fw-ok 的文字，没有是 null
  on: string[]; // 实心的日点，写成「周一」这样
  today: string | null; // 今天的日点，写成「周三」
  dots: number; // 日点总数
  aria: string; // .fw-dots 的 aria-label
  role: string | null; // .fw-dots 的 role
};

// 读健身页的本周训练块
export async function readFitWeek(page: Page): Promise<FitWeekRead> {
  return page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll<HTMLElement>('#fw .fw-d'));
    const name = (d: HTMLElement) => '周' + (d.querySelector('span')?.textContent ?? '');
    const dotsEl = document.querySelector('#fw .fw-dots');
    const t = dots.find((d) => d.classList.contains('today'));
    return {
      n: document.querySelector('#fw .fw-n')?.textContent ?? '',
      goal: document.querySelector('#fw .fw-goal')?.textContent ?? '',
      ok: document.querySelector('#fw .fw-ok')?.textContent ?? null,
      on: dots.filter((d) => d.classList.contains('on')).map(name),
      today: t ? name(t) : null,
      dots: dots.length,
      aria: dotsEl?.getAttribute('aria-label') ?? '',
      role: dotsEl?.getAttribute('role') ?? null,
    };
  });
}

// ---- Phase 15-05：训练历史 ----

export type HistoryItem = {
  date: string; // data-fh
  open: boolean; // details 是否展开
  summary: string; // summary 里 b 的文字加 span 的文字，中间一个空格
  lines: string[]; // 展开后每个动作一行（.fh-body > p）
};
export type HistoryRead = {
  months: string[]; // #fh 里 .tl-month 的文字，按出现顺序
  items: HistoryItem[];
  more: string | null; // #fhMore 的文字，没有按钮是 null
  empty: string | null; // #fh .empty 的文字，没有是 null
};

// 读健身页底部的训练历史（只读合成数据；返回文字和布尔，用例自己和期望值比较）
export async function readHistory(page: Page): Promise<HistoryRead> {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll<HTMLDetailsElement>('#fh details.fh-item')).map((d) => ({
      date: d.dataset.fh ?? '',
      open: d.open,
      summary: (d.querySelector('summary b')?.textContent ?? '') + ' ' + (d.querySelector('summary span')?.textContent ?? ''),
      lines: Array.from(d.querySelectorAll('.fh-body > p')).map((p) => p.textContent ?? ''),
    }));
    return {
      months: Array.from(document.querySelectorAll('#fh .tl-month')).map((m) => m.textContent ?? ''),
      items,
      more: document.querySelector('#fhMore')?.textContent ?? null,
      empty: document.querySelector('#fh .empty')?.textContent ?? null,
    };
  });
}
