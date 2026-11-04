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

// toast 动作按钮的文字（应用源码逐字复制）
export const TOAST_UNDO_LABEL = '撤销';

// 点“直接记录”预设后 toast 的前缀，冒号是全角，后面接标签文字（应用源码逐字复制）
export const TOAST_RECORDED_PREFIX = '已记录：';

// 添加预设标签后 toast 的前缀，冒号是全角，后面接标签文字（应用源码逐字复制）
export const TOAST_PRESET_ADDED_PREFIX = '已添加标签：';

// 添加已存在的预设标签时的 toast（应用源码逐字复制）
export const TOAST_PRESET_DUPLICATE = '已经有这个标签了';

// 删除预设标签后 toast 的前缀，冒号是全角，后面接标签文字（应用源码逐字复制）
export const TOAST_PRESET_DELETED_PREFIX = '已删除标签：';

// 预设区编辑按钮在普通模式下的文字（应用源码逐字复制）
export const PRESET_EDIT_LABEL = '编辑';

// 预设区编辑按钮在编辑模式下的文字（应用源码逐字复制）
export const PRESET_EDIT_DONE_LABEL = '完成';

// ---- 本周视图（WEEK-01、WEEK-02、WEEK-05）----

// 周标题：抵达日期所在周之后写“来美国第 N 周”，前缀和后缀（应用源码逐字复制）
export const WEEK_TITLE_ARRIVAL_PREFIX = '来美国第 ';
export const WEEK_TITLE_ARRIVAL_SUFFIX = ' 周';

// 周标题：既不在抵达日期之后、也不是今天所在周时的通用标题（应用源码逐字复制）
export const WEEK_TITLE_OTHER = '这一周';

// 日期文案片段（应用源码逐字复制）：月、日的后缀，星期的前缀
export const MONTH_SUFFIX = '月';
export const DAY_SUFFIX = '日';
export const WEEKDAY_PREFIX = '周';

// 星期字符，下标是 Date.getDay() 的值（周日为 0）（应用源码逐字复制）
export const WEEKDAY_CHARS = '日一二三四五六';

// 周范围的分隔符：U+2013 en dash，两边各一个空格（应用源码逐字复制）
export const WEEK_RANGE_SEPARATOR = ' – ';

// 类别卡上计数后面的单位（应用源码逐字复制）
export const AREA_COUNT_UNIT = '项';

// 非健身类别的目标行后缀，前面接不同日期数（应用源码逐字复制）
export const WEEK_GOAL_RECORDED_SUFFIX = ' 天有记录';

// 健身目标行的前缀和日期数后面的单位；目标数值是个人计划，不写进仓库（应用源码逐字复制）
export const WEEK_GOAL_FIT_PREFIX = '训练 ';
export const WEEK_GOAL_DAY_UNIT = ' 天';

// 日期列的 aria-label：月日、分隔符、条目数、后缀（应用源码逐字复制）
export const DAY_ARIA_SEPARATOR = '，';
export const DAY_ARIA_SUFFIX = ' 项，点击选为记录日期';

// composer 下方“记录到 M月D日 周X”的前缀（应用源码逐字复制）
export const COMPOSER_WHEN_PREFIX = '记录到 ';

// 内置计划组号到类别的映射：只来自应用 GROUPS 的组号和类别字段，不含组名和任何任务文字。
// 健身没有目标组。值引用 CATEGORY_NAMES，不再写新的中文字面量
export const GROUP_CATEGORY: Record<string, string> = {
  P1: CATEGORY_NAMES[0],
  P2: CATEGORY_NAMES[1],
  P3: CATEGORY_NAMES[1],
  P4: CATEGORY_NAMES[1],
  P5: CATEGORY_NAMES[1],
  P6: CATEGORY_NAMES[3],
  P7: CATEGORY_NAMES[4],
};

// 把记录拖到另一天后 toast 的前缀，后面接 M月D日（应用源码逐字复制）
export const TOAST_MOVED_PREFIX = '已移到 ';

// 编辑记录弹窗的标题
export const EDITOR_TITLE_LOG = '编辑记录';
// 编辑已完成计划弹窗的标题
export const EDITOR_TITLE_TASK = '完成的计划';
// 保存后没有改日期时的 toast
export const TOAST_SAVED = '已保存';
// 保存并改了日期时的 toast 前缀，后面接 M月D日
export const TOAST_SAVED_MOVED_PREFIX = '已保存，移到 ';

// 编辑弹窗里文字只剩空白时点保存的提示（弯引号从应用源码复制）
export const TOAST_EMPTY_TEXT = '内容不能为空，想删掉请点“删除”';
// 在弹窗里删除记录后的 toast
export const TOAST_LOG_DELETED = '已删除这条记录';
// 点撤销后的 toast
export const TOAST_RESTORED = '已恢复';
// 在完成计划弹窗里点“标记为未完成”后的 toast（应用源码逐字复制）
export const TOAST_MARKED_UNDONE = '已改回未完成';

// ---- 日历视图（CAL-01 到 CAL-04）----

// 月份标题“YYYY 年 M 月”：年后的分隔符前后各一个空格，月后缀前面一个空格（应用源码第 482 行逐字复制）
export const MONTH_TITLE_YEAR_SEP = ' 年 ';
export const MONTH_TITLE_MONTH_SUFFIX = ' 月';

// 日历格子 aria-label 里三个计数后面的文字，前面接数字（应用源码第 490 行逐字复制）
export const CELL_ARIA_LOGS_SUFFIX = ' 条记录';
export const CELL_ARIA_DUE_SUFFIX = ' 项到期';
export const CELL_ARIA_DONE_SUFFIX = ' 项完成';

// 日面板的分区标题（应用源码第 497-503 行逐字复制）
export const DAY_SECTION_LOGS = '做过的事';
// 与 EDITOR_TITLE_TASK 文字相同，但这里是日面板的分区标题
export const DAY_SECTION_DONE = '完成的计划';
export const DAY_SECTION_DUE = '这天到期';

// 这天没有记录时的空提示，句号是全角（应用源码第 501 行逐字复制）
export const DAY_EMPTY = '这天还没有记录。';

// 日面板副标题：抵达日及之后写“来美国第 N 天”，之前写“YYYY 年”（应用源码第 497 行逐字复制）
export const DAY_SUB_ARRIVAL_PREFIX = '来美国第 ';
export const DAY_SUB_ARRIVAL_SUFFIX = ' 天';
export const DAY_SUB_YEAR_SUFFIX = ' 年';

// ---- 目标视图的力量卡（GOAL-02）----

// 达标时 toast 的后缀，前面接力量名称（应用源码第 630 行逐字复制）。
// toast 的前半是力量名称（个人计划文字），所以只比较固定片段（D-02）
export const LIFT_REACHED_SUFFIX = '达标了';

// 未达标时 toast 里的固定片段，前面是力量名称，后面接数值和单位（应用源码第 630 行逐字复制，末尾一个空格）。
// 同样只比较固定片段，不比较整句（D-02）
export const LIFT_UPDATED_INFIX = '已更新为 ';

// 力量历史行里几条记录之间的分隔符，全角逗号（应用源码第 512 行逐字复制）
export const LIFT_HISTORY_SEPARATOR = '，';


// ---- 目标视图的任务（GOAL-03 到 GOAL-05）----

// 勾选任务后的 toast（应用源码第 623 行逐字复制，逗号是全角）
export const TOAST_TASK_DONE = '完成，已记到今天';

// 已完成任务行里的“完成于 ”前缀，后面接 M月D日，末尾一个空格（应用源码第 523 行逐字复制）
export const GOAL_DONE_ON_PREFIX = '完成于 ';

// 未完成且没有过期的任务行里的标记文字（应用源码第 523 行逐字复制）；过期时是上面的 GOAL_OVERDUE
export const GOAL_DUE_LABEL = '截止';

// ---- 时间线（TL-01、TL-02）----

// 时间线筛选按钮的 data-filter 值：“全部”（应用源码第 530 行逐字复制）。类别筛选的值用 CATEGORY_NAMES
export const FILTER_ALL = '全部';

// 时间线筛选按钮的 data-filter 值：“完成的计划”（应用源码第 530 行逐字复制）。
// 与 EDITOR_TITLE_TASK、DAY_SECTION_DONE 文字相同，但这里是时间线筛选按钮的值
export const FILTER_DONE_TASKS = '完成的计划';

// ---- 导入（IO-04、IO-05）----

// 选了备份文件后的替换确认框文案（应用源码第 657 行逐字复制，末尾是全角问号）
export const CONFIRM_IMPORT = '用备份文件替换当前所有内容？';

// 文件不是备份（解析失败或 normalize 抛错）时的 toast（应用源码第 657 行逐字复制，逗号是全角，.json 前有一个空格）。
// 接受导入后的 toast 复用上面的 TOAST_RESTORED（与撤销后的 toast 文字相同）
export const TOAST_IMPORT_BAD_FORMAT = '文件格式不对，请选择导出的备份 .json';
