// _synthetic：合成的恶意载荷，只在内存里使用（SEC-01）。
// 载荷都以 SYNTH 开头或带 synth 字样；检测靠 data-synth-xss 属性、多出来的元素和 window.__synthXss 计数，
// 不用 img src=… 一类会去取资源的写法（那会被网络护栏记成页面错误）。
// 唯一的例外是 IMG_PAYLOAD：src 不带值，浏览器不发请求、直接触发 error，只用在计划值用例里（ROADMAP 成功标准 3）。
// 本文件不含任何个人计划文字；计划值的载荷由 maliciousPlanValues() 给出，只在内存里改 DEFAULT_PLAN。
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../support/constants';
import { CAT_LANGUAGE, CATEGORY_NAMES } from '../support/strings';

// 标签注入：多出一个 details 和带标记的 s，toggle 事件会让计数加 1
export const TAG_PAYLOAD =
  'SYNTH-XSS <details open ontoggle="window.__synthXss=(window.__synthXss||0)+1"><s data-synth-xss>x</s></details>';
// 脚本：innerHTML 不会执行，但出现了 script 元素就说明转义失效
export const SCRIPT_PAYLOAD = 'SYNTH-XSS <script>window.__synthXss=(window.__synthXss||0)+100</script>';
// 用引号断开属性
export const DQ_PAYLOAD = 'SYNTH-XSS" data-synth-xss="1';
export const SQ_PAYLOAD = "SYNTH-XSS' data-synth-xss='1";
// 用在 id 上
export const ID_PAYLOAD = 'synth-x" data-synth-xss="1';
export const CUSTOM_ID_PAYLOAD = 'c-synth" data-synth-xss="1';
// 用在 group 上
export const GROUP_PAYLOAD = '<s data-synth-xss>G';
// 用在日期上：属性上下文，以及时间线月份标题（只取前 4 个字符）
export const DATE_ATTR_PAYLOAD = '2026-03-18" data-synth-xss="1';
export const DATE_TAG_PAYLOAD = '<s>2026-03-18';
// 用在力量当前值和力量历史的数值上
export const CUR_PAYLOAD = '1" data-synth-xss="1';
export const HIST_PAYLOAD = '<s>9';
// 空 src 的 img：不发请求，浏览器直接触发 error
export const IMG_PAYLOAD = 'SYNTH-XSS <img src onerror="window.__synthXss=(window.__synthXss||0)+1000">';

// 每次返回新对象，顶层带 _synthetic。四条今天的记录和任务让每个视图都有地方展示载荷
export function maliciousState() {
  return {
    _synthetic: 'SYNTH malicious state for SEC-01',
    arrival: '2026-01-12',
    logs: [
      { id: 'synth-log-1', date: FROZEN_TODAY, cat: CAT_LANGUAGE, text: TAG_PAYLOAD },
      { id: 'synth-log-2', date: FROZEN_TODAY, cat: CATEGORY_NAMES[1], text: SCRIPT_PAYLOAD },
      { id: ID_PAYLOAD, date: FROZEN_TODAY, cat: CATEGORY_NAMES[2], text: 'SYNTH log with an id payload' },
      { id: 'synth-log-4', date: DATE_ATTR_PAYLOAD, cat: CAT_LANGUAGE, text: 'SYNTH log with a date attribute payload' },
      { id: 'synth-log-5', date: DATE_TAG_PAYLOAD, cat: CAT_LANGUAGE, text: 'SYNTH log with a date tag payload' },
    ],
    custom: [
      { id: 'c-synth-1', group: 'P1', text: DQ_PAYLOAD, due: DATE_ATTR_PAYLOAD },
      { id: CUSTOM_ID_PAYLOAD, group: 'P1', text: 'SYNTH task with an id payload' },
      { id: 'c-synth-3', group: GROUP_PAYLOAD, text: 'SYNTH task with a group payload' },
      { id: 'c-synth-4', group: 'P1', text: 'SYNTH task with a done date payload' },
    ],
    tasks: {
      'c-synth-1': { due: DATE_ATTR_PAYLOAD },
      [CUSTOM_ID_PAYLOAD]: { done: true, doneDate: FROZEN_TODAY },
      'c-synth-3': { done: true, doneDate: FROZEN_TODAY },
      'c-synth-4': { done: true, doneDate: DATE_ATTR_PAYLOAD },
    },
    lifts: {
      bench: { cur: CUR_PAYLOAD, hist: [{ date: '2026-03-10', v: HIST_PAYLOAD }] },
    },
    reviews: { [WEEK_START_FROZEN]: TAG_PAYLOAD },
    presets: { [CAT_LANGUAGE]: { add: [TAG_PAYLOAD], hide: [] } },
  };
}

// 计划值的载荷（只在内存里改 DEFAULT_PLAN，由 planValueEdit 放进页面）。
// 每项的值是一个载荷加一个区分字段的合成后缀 SYNTH-F1 到 SYNTH-F7，让页面断言分得清是哪个字段。
// path 是 DEFAULT_PLAN 里的字段路径；失败消息只写 path，不写计划文字。
export const PLAN_SUFFIXES = [' SYNTH-F1', ' SYNTH-F2', ' SYNTH-F3', ' SYNTH-F4', ' SYNTH-F5', ' SYNTH-F6', ' SYNTH-F7'] as const;

export function maliciousPlanValues(): { path: string; value: string }[] {
  return [
    { path: 'groups[0].name', value: SCRIPT_PAYLOAD + PLAN_SUFFIXES[0] },
    { path: 'groups[1].note', value: IMG_PAYLOAD + PLAN_SUFFIXES[1] },
    { path: 'groups[0].tasks[0].text', value: TAG_PAYLOAD + PLAN_SUFFIXES[2] },
    { path: 'lifts[0].n', value: DQ_PAYLOAD + PLAN_SUFFIXES[3] },
    { path: 'lifts[0].note', value: IMG_PAYLOAD + PLAN_SUFFIXES[4] },
    { path: 'presets.lang[0]', value: DQ_PAYLOAD + PLAN_SUFFIXES[5] },
    { path: 'fitNote', value: SQ_PAYLOAD + PLAN_SUFFIXES[6] },
  ];
}
