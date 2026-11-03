// 所有界面中文文案只放在这里，用例从这里引用（D-08）。
// 不要抄 CATS、GROUPS、LIFTS 里的个人计划文字（D-09）。
// 例外：类别显示名和 LEGACY 旧类别名是结构性标签，按 Phase 2 D-12 的澄清可以写，并且只写在这个文件里。

// 本地模式下状态行的文案，括号是全角；它出现说明 store 已就位
export const STATUS_LOCAL = '已保存在此浏览器中（换设备不会同步）';

// 记录一条后弹出的 toast 文案
export const TOAST_RECORDED = '已记录';

// 类别名：应用持久化的是中文显示名，不是键
export const CAT_LANGUAGE = '语言';

// 四个标签的文案，键是 data-tab 的值（应用源码逐字复制）
export const TAB_LABELS = { wk: '本周', cal: '日历', goal: '目标', tl: '时间线' } as const;

// 本周视图的标题（应用源码逐字复制）
export const WEEK_TITLE_CURRENT = '本周';

// 冻结日 2026-03-18 所在周的范围文案：中间是 U+2013 en dash，两边各一个空格
export const WEEK_RANGE_FROZEN = '3月16日 – 22日';

// 账户模式下状态行的文案（应用源码逐字复制）；它出现说明应用走了 db 存储
export const STATUS_ACCOUNT = '已同步保存到你的账户';

// 导出成功后弹出的 toast 文案（应用源码逐字复制）
export const TOAST_EXPORTED = '已导出';

// 日历 CSV 的导出文件名（应用源码逐字复制）
export const FILENAME_CSV = '在美国的日子-日历.csv';

// JSON 备份的导出文件名；日期是冻结的今天 2026-03-18（D-16）。只是字符串常量，不对应磁盘上的文件
export const FILENAME_BACKUP_FROZEN = '在美国的日子-备份-2026-03-18.json';

// 五个类别的显示名，即应用 CATS 的 n 字段，应用持久化的就是它们；按 D-12 的澄清允许复制，第一项复用上面的 CAT_LANGUAGE
export const CATEGORY_NAMES = [CAT_LANGUAGE, '专业', '健身', '求职', '其他'] as const;

// “其他”类别的显示名：未知类别经 normalize 后落到这里（D-12 澄清允许复制）
export const CAT_OTHER = '其他';

// 应用 normalize 用的 LEGACY 旧类别映射：旧名 -> 新名，按 D-12 的澄清允许复制，DATA-02 用
export const LEGACY_CATEGORY_MAP = { 学习: '专业', 活动社交: '求职', 生活: '其他', 里程碑: '其他' } as const;

// 目标视图里已过期任务的标记文字（应用源码逐字复制）
export const GOAL_OVERDUE = '已过期';

// 力量输入框下方历史行的前缀，冒号是全角（应用源码逐字复制）
export const LIFT_HISTORY_PREFIX = '最近：';

// 时间线空状态文案，含弯引号（应用源码逐字复制）
export const TIMELINE_EMPTY = '还没有内容。在“本周”里写下今天做过的事。';

// 日历 CSV 的表头（应用源码逐字复制）
export const CSV_HEADER = 'Subject,Start Date,All Day Event,Description';

// CSV 里已完成任务的主题前缀，冒号是全角（应用源码逐字复制）
export const CSV_DONE_PREFIX = '完成：';

// CSV 里有截止日期的未完成任务的主题前缀，冒号是全角（应用源码逐字复制）
export const CSV_DUE_PREFIX = '截止：';

// CSV 任务行的描述后缀，前面有一个空格；前面接组号（应用源码逐字复制）
export const CSV_GROUP_SUFFIX = ' 计划';

// 没有任何可导出的日期时 #exportCsv 弹出的 toast（应用源码逐字复制）
export const TOAST_NOTHING_TO_EXPORT = '还没有可导出的日期';
