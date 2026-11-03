// 所有界面中文文案只放在这里，用例从这里引用（D-08）。
// 不要抄 CATS、GROUPS、LIFTS 里的个人计划文字（D-09）。

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
