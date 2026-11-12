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
// IN-05：账号的计划读不出来（示例计划在用）时导出备份的提示，替换“已导出”（应用里 T_EXPORT_SAMPLE_PLAN 的逐字复制，6000 ms）
export const TOAST_EXPORTED_SAMPLE_PLAN = '已导出。账号的计划读不出来，备份里的计划是示例计划，导入它会换掉账号的计划。';

// 应用名：文档标题、登录卡标题和页头 h1（应用源码逐字复制）
export const APP_NAME = '计划手记';

// 页头开始日期的标签文字（应用源码逐字复制）
export const START_DATE_LABEL = '开始日期';

// 页头计数器：没设开始日期时的提示（应用源码逐字复制）
export const COUNTER_UNSET = '先设置开始日期';

// 页头计数器：开始日期当天及之后写“第 N 天”（应用源码逐字复制）
export const COUNTER_DAY_PREFIX = '第';
export const COUNTER_DAY_SUFFIX = '天';

// 页头计数器：开始日期之前写“还有 N 天开始”（应用源码逐字复制）
export const COUNTER_BEFORE_PREFIX = '还有';
export const COUNTER_BEFORE_SUFFIX = '天开始';

// 日历 CSV 的导出文件名（应用源码逐字复制）
export const FILENAME_CSV = '计划手记-日历.csv';

// JSON 备份的导出文件名；日期是冻结的今天 2026-03-18（D-16）。只是字符串常量，不对应磁盘上的文件
export const FILENAME_BACKUP_FROZEN = '计划手记-备份-2026-03-18.json';

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

// 周标题：开始日期（state.arrival）所在周之后写“第 N 周”，前缀和后缀（应用源码逐字复制）
export const WEEK_TITLE_ARRIVAL_PREFIX = '第 ';
export const WEEK_TITLE_ARRIVAL_SUFFIX = ' 周';

// 周标题：既不在开始日期之后、也不是今天所在周时的通用标题（应用源码逐字复制）
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

// 日面板副标题：开始日期（state.arrival）及之后写“第 N 天”，之前写“YYYY 年”（应用源码逐字复制）
export const DAY_SUB_ARRIVAL_PREFIX = '第 ';
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

// CR-01：已完成但没有记下完成日期的任务，行上写这个，不写“完成于”（应用里目标视图任务行的逐字复制）
export const GOAL_DONE_NO_DATE = '已完成';

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

// USJ_CONFIG 配了不支持的后端时状态行的文案（应用源码逐字复制）；它出现说明应用停在加载之前、没有悄悄退回本地
export const STATUS_BACKEND_UNSUPPORTED = '存储配置无效：这个版本还不支持所配置的后端，修改不会保存';

// 云端路径下状态行在已同步时的文案（09-UI-SPEC 状态文案总表逐字复制）；#status 的 data-state 同时为 synced
export const STATUS_CLOUD_SYNCED = '已同步';

// 云端路径下保存进行中（防抖期间和请求进行中）的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；#status 的 data-state 同时为 saving
export const STATUS_SAVING = '保存中…';

// 云端路径下请求没到达服务器时的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；#status 的 data-state 同时为 offline，不显示横幅。
// n 大于 0 用带数量的那句，否则用不带数量的那句；n 是本机待上传的条目数（缓存记录里的 touched 集合）
export function statusOffline(n: number): string {
  return n > 0 ? `离线，${n} 项修改已存在本机，联网后自动上传` : '离线，修改已存在本机，联网后自动上传';
}

// 云端保存失败（服务器回 5xx、429、其他 4xx 或请求约 15 秒没有答复）时的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；
// #status 的 data-state 同时为 retrying，不显示横幅。{s} 是距离下次自动重试的秒数（向上取整，最小 1）。
// 状态行是“这句话 + 一个行内按钮”：句子是 #status 的第一个文字节点，按钮文字是 BTN_RETRY_NOW
export function statusRetrying(s: number): string {
  return `保存失败，修改仍在本机，${s} 秒后自动重试`;
}
export const BTN_RETRY_NOW = '立即重试';

// 登录页错误区：邮箱或密码不对（09-UI-SPEC Copywriting 逐字复制）
export const LOGIN_ERR_CREDENTIALS = '邮箱或密码不对，请检查后重试';

// 登录页错误区：连不上服务器（09-UI-SPEC Copywriting 逐字复制）
export const LOGIN_ERR_UNREACHABLE = '连不上服务器，请检查网络后重试';

// 登录页错误区：尝试次数太多，对应 429（09-UI-SPEC Copywriting 逐字复制）
export const LOGIN_ERR_RATE = '尝试次数太多，请过几分钟再试';

// 登录按钮在提交中的文字（09-UI-SPEC Copywriting 逐字复制）；按钮同时 disabled、aria-busy 为 true
export const LOGIN_BUSY = '登录中…';

// 登录页错误区：有字段为空，点登录时只在本地检查（09-UI-SPEC Copywriting 逐字复制）
export const LOGIN_ERR_EMPTY = '请填写邮箱和密码';

// 登录页显示密码按钮的文字与 aria-label（09-UI-SPEC S1 逐字复制）：隐藏状态与明文状态各一组
export const PW_SHOW = '显示';
export const PW_HIDE = '隐藏';
export const PW_SHOW_LABEL = '显示密码';
export const PW_HIDE_LABEL = '隐藏密码';

// 云端路径对账中的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；#status 的 data-state 同时为 reconciling
export const STATUS_RECONCILING = '正在和服务器对账…';

// 对账后用服务器版本替换了本机缓存、且两者确实不同时的 toast（09-UI-SPEC S5 D-04 逐字复制，4000 ms）
export const TOAST_REMOTE_UPDATED = '已更新为其他设备上的最新内容';

// 本机缓存写不进去（localStorage 配额不够）时：横幅正文（warn，带 BTN_ACK）和云端保存也失败时的状态行文案。
// 此时修改只在内存里，不能再说“修改仍在本机”；09-UI-SPEC 没有这两句，是审查修复（WR-05）补的
export const BANNER_CACHE_FULL = '本机空间不够，没能在本机保存这次修改。上传成功之前请别关闭或刷新页面。';
export const STATUS_SAVE_FAILED_NO_CACHE = '保存失败：本机空间不够，这次修改没能保存，请先别关闭页面';

// 对账约 3 秒仍未完成时的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；#status 的 data-state 同时为 slow。
// 没有缓存时等待卡片的标题用同一句
export const STATUS_SLOW = '网络较慢，还在连…';

// 对账约 15 秒仍未完成时的状态行文案（09-UI-SPEC S2 状态文案总表逐字复制）；#status 的 data-state 同时为 unreachable
export const STATUS_UNREACHABLE = '连不上服务器，暂时只能查看，不能修改';

// 顶部横幅 #syncbar 在对账变慢时的正文（09-UI-SPEC S4 横幅文案总表逐字复制，无按钮）；data-tone 为 warn
export const BANNER_SLOW = '网络较慢，还在连…现在还不能修改。';

// 顶部横幅 #syncbar 在连不上（只读）时的正文（09-UI-SPEC S4 横幅文案总表逐字复制）；data-tone 为 error，带一个重试按钮
export const BANNER_UNREACHABLE = '连不上服务器，现在只能查看上次的内容，不能修改。';

// 横幅和等待卡片里的重试按钮文字（09-UI-SPEC S4 按钮列），点击后立即换成 BTN_RETRYING 并 disabled（S2 规则）
export const BTN_RETRY = '重试';
export const BTN_RETRYING = '正在重试…';

// 没有缓存（第一次登录或重新登录）时的等待卡片文案（09-UI-SPEC S10 逐字复制）：加载中的标题和副文字
export const BOOT_TITLE_LOADING = '正在加载你的数据…';
export const BOOT_SUB_LOADING = '第一次登录需要先从服务器取数据';

// 等待卡片约 15 秒仍未完成时的标题和副文字（09-UI-SPEC S10 逐字复制）；卡片里只剩一个重试按钮
export const BOOT_TITLE_UNREACHABLE = '连不上服务器';
export const BOOT_SUB_UNREACHABLE = '请检查网络，然后重试';

// 真冲突时的 toast（09-UI-SPEC S5/S8 逐字复制，8000 ms，带 BTN_DOWNLOAD_SNAPSHOT 按钮）
export const TOAST_CONFLICT = '另一台设备上的修改被覆盖，已在本机留底';

// 工具栏常驻按钮 #snapshotBtn 和 toast 里按钮的文字（09-UI-SPEC S8，固定不变）
export const BTN_DOWNLOAD_SNAPSHOT = '下载留底';

// 点下载后立即弹出的 toast（09-UI-SPEC S8 D-10 逐字复制，3000 ms）
export const TOAST_SNAPSHOT_DOWNLOADED = '已开始下载留底，本机不再保留副本';

// 冻结日期（2026-03-18）下载留底的文件名：只有应用名、种类和日期，不含任何账号标识（D-11）
export const FILENAME_SNAPSHOT_FROZEN = '计划手记-留底-2026-03-18.json';

// 留底生成或下载出错时的 toast（09-UI-SPEC S5/S8 D-10 逐字复制，4000 ms）；此时不删留底、#snapshotBtn 保留
export const TOAST_SNAPSHOT_FAILED = '留底生成失败，本机副本仍然保留';

// 留底存不下（localStorage 配额不够等）时的横幅正文（09-UI-SPEC S4 逐字复制）；data-tone 为 warn，带 BTN_ACK 按钮
export const BANNER_SNAPSHOT_NOT_KEPT =
  '另一台设备上的修改被覆盖了，但本机空间不够，没能留底。请到另一台设备上核对被覆盖的内容。';

// 横幅上“知道了”按钮的文字（09-UI-SPEC S4 按钮列，.ghost）
export const BTN_ACK = '知道了';

// 云端保存因文档超过容量上限失败时的状态行文案（09-UI-SPEC S2/S9 逐字复制）；#status 的 data-state 同时为 toolarge
export const STATUS_TOO_LARGE = '保存失败：数据超过容量上限（4 MB）';

// 超过容量上限时的 error 横幅正文（09-UI-SPEC S4 逐字复制），不可关闭、没有按钮
export const BANNER_TOO_LARGE = '数据超过了云端容量上限，新修改存不上了，请联系管理员。';

// 达到容量上限 70% 时的 warn 横幅正文（09-UI-SPEC S4/S9 逐字复制）；pct 是向下取整的整数
export const bannerCapacity = (pct: number) =>
  `保存空间快满了：已用 ${pct}%（上限 4 MB）。超过上限后新修改就存不上了，请联系管理员。`;

// 登录页顶部的登录过期提示（09-UI-SPEC S1 逐字复制）：authRefresh 返回 401 或本地令牌已过 exp 后进入登录页时显示，#loginNotice 的 data-tone 为 warn；
// 会话中途发现过期时它也是状态行（data-state 为 expired）的文案（09-UI-SPEC S2）
export const LOGIN_EXPIRED = '登录已过期，请重新登录';

// 会话中途登录过期的横幅正文（09-UI-SPEC S4 逐字复制，#syncbar 的 data-tone 为 warn，只有一个按钮 BTN_RELOGIN）
export const BANNER_EXPIRED = '登录已过期，本机的修改还在，重新登录后会继续上传。';
export const BTN_RELOGIN = '重新登录';

// 登录过期提示的第二行：这个账号在本机还有没上传的修改或留底时才有（09-UI-SPEC S1 逐字复制）
export const LOGIN_EXPIRED_UNSENT = '本机还有没上传的修改，用同一账号登录后会自动上传。';

// 工具栏的退出登录按钮文字（09-UI-SPEC S7，#logoutBtn）和退出过程中的文字（E5 loading，按钮同时 disabled）
export const BTN_LOGOUT = '退出登录';
export const BTN_LOGGING_OUT = '正在退出…';

// 另一个标签页退出登录后，本标签页登录页顶部的提示（09-UI-SPEC S1、Assumption A5 逐字复制）；#loginNotice 的 data-tone 为 info
export const NOTICE_OTHER_TAB = '已在另一个标签页退出登录';

// 退出确认框（09-UI-SPEC S7，D-05，逐字复制）：dialog#confirm，正文第一行是 当前账号：{邮箱}，后两行按实际情况出现
export const CONFIRM_LOGOUT_TITLE = '退出登录？';
export const CONFIRM_LOGOUT_ACCOUNT_PREFIX = '当前账号：';
export const CONFIRM_LOGOUT_UNSAVED = '有修改还没保存到服务器，退出后会丢失。';
export const CONFIRM_LOGOUT_SNAPSHOT = '有一份另一台设备的旧版本留底还没下载，退出后会丢失。';
export const BTN_STAY = '不退出';
export const BTN_LOGOUT_ANYWAY = '仍然退出';

// 换账号登录确认框（09-UI-SPEC S7，Claude's Discretion）：凭据通过之后、清除前一个账号的本机数据之前弹出
export const CONFIRM_SWITCH_TITLE = '换账号登录？';
export const BTN_NO_SWITCH = '不换账号';
export const BTN_SWITCH_ANYWAY = '仍然登录';
// parts：按实际情况出现的 没上传的修改、没下载的留底，两样都有时用 、 连接
export const switchBody = (email: string, parts: string[]) =>
  `这台设备上还有 ${email} ${parts.join('、')}，换账号登录后会被清除。`;

// 远端更新挂起时的横幅（09-UI-SPEC S4 的“远端更新待应用”行逐字复制；#syncbar 的 data-tone 为 info，只有一个按钮 BTN_APPLY_NOW）
export const BANNER_REMOTE = '其他设备有新的修改，稍后会自动更新。';
// 横幅上的按钮文字（09-UI-SPEC S4 按钮列、S6 逐字复制）
export const BTN_APPLY_NOW = '现在更新';

// D-06：编辑弹窗里的记录在另一台设备上被删除，用户点保存后按编辑框内容以同一个 id 加回时的提示（所有者 2026-11-10 确认的文案，4000 ms）
export const TOAST_LOG_READDED = '这条记录在另一台设备上被删除，已按你的修改重新加回';

// ---- 云端导入（IO-07、IO-08、IO-10；Phase 11-01）----
// 摘要确认框（dialog#confirm）的文案，应用里 T_IMP_* 常量的逐字复制（09-UI-SPEC 的语气）。
// 拒绝提示复用上面的 TOAST_IMPORT_BAD_FORMAT。
export const CONFIRM_IMPORT_TITLE = '导入这个文件？';
export const BTN_IMPORT_CANCEL = '不导入';
export const BTN_IMPORT_OK = '导入';
// 旧备份（原 Artifact 导出的裸 state）的两行：文件类型、将替换什么（D-02：只替换记录，计划不变）
export const IMPORT_KIND_LEGACY = '文件类型：原应用导出的旧备份';
export const IMPORT_REPLACE_LEGACY = '将替换：当前账号的记录，计划不变';
// 记录条数和日期范围；条数为 0 时只写“记录 0 条”
export function importLogsLine(n: number, from: string, to: string): string {
  return n > 0 ? `记录 ${n} 条（${from} 至 ${to}）` : '记录 0 条';
}
// 当前账号现有记录条数
export function importCurrentLine(n: number): string {
  return `当前账号现有记录 ${n} 条`;
}
// 导入成功后的 toast（云端，4000 ms）
export const TOAST_IMPORTED = '已导入';

// 摘要里的复盘周数、完成的任务数、力量记录数（Phase 11-01 Task 2；应用里 T_IMP_MORE 的逐字复制）
export function importMoreLine(reviews: number, done: number, liftEntries: number): string {
  return `复盘 ${reviews} 周，完成的任务 ${done} 项，力量记录 ${liftEntries} 条`;
}
// D-07：旧备份里对不上当前计划的任务进度条数（醒目行；应用里 T_IMP_ORPHAN_LEGACY 的逐字复制）
export function importOrphanLegacyLine(n: number): string {
  return `${n} 条任务进度对不上当前计划，导入后会丢弃。建议先导入计划，再导入这份备份。`;
}

// Phase 11-03：新格式完整备份的摘要行（应用里 T_IMP_KIND_FULL、T_IMP_REPLACE_FULL、T_IMP_PLAN、T_IMP_ORPHAN_FILE 的逐字复制）
export const IMPORT_KIND_FULL = '文件类型：新格式备份（计划和记录）';
export const IMPORT_REPLACE_FULL = '将替换：当前账号的计划和记录';
// 文件里计划的规模：目标组数、任务数（含归档的任务）、力量项数
export function importPlanLine(groups: number, tasks: number, lifts: number): string {
  return `计划：目标组 ${groups} 个，任务 ${tasks} 项，力量项 ${lifts} 个`;
}
// D-07：文件里的任务进度对不上文件里的计划的条数（醒目行）
export function importOrphanFileLine(n: number): string {
  return `${n} 条任务进度对不上文件里的计划，导入后会丢弃。`;
}

// Phase 11-03 Task 2：只含计划的文件的摘要行（应用里 T_IMP_KIND_PLAN、T_IMP_REPLACE_PLAN、T_IMP_ORPHAN_PLAN 的逐字复制）
export const IMPORT_KIND_PLAN = '文件类型：只含计划的文件';
export const IMPORT_REPLACE_PLAN = '将替换：当前账号的计划，记录不变';
// D-07：账号现有的任务进度对不上新计划的条数（醒目行）
export function importOrphanPlanLine(n: number): string {
  return `${n} 条现有的任务进度对不上新计划，导入后会丢弃。`;
}
// WR-01：自定义待办的目标组不在导入后所用的计划里的条数（醒目行；应用里 T_IMP_ORPHAN_CUSTOM 的逐字复制，三种文件共用）
export function importOrphanCustomLine(n: number): string {
  return `${n} 条自定义待办的目标组不在计划里，导入后放在目标页底部的「已归档」里。`;
}

// Phase 11-04 Task 1：导入的两个上限（应用里 T_IMP_TOO_BIG、T_IMP_TOO_LARGE 的逐字复制）。
// 文件超过 5 MB 在读之前拒绝；文件里的数据超过云端容量上限（4 MB，Phase 9）在确认之前拒绝；两种都不弹确认框、不改任何数据
export const TOAST_IMPORT_TOO_BIG = '文件太大（超过 5 MB），没有导入';
export const TOAST_IMPORT_TOO_LARGE = '数据超过容量上限（4 MB），没有导入';

// Phase 11-06 Task 1：导入前留的数据和“撤销导入”（应用里 T_UNDO_BTN、T_IMP_UNDO_NOTE、T_IMP_NO_UNDO、T_UNDO_TITLE、T_UNDO_CHANGED、T_UNDO_MORE、T_UNDO_NO、T_UNDO_YES、T_UNDONE 的逐字复制）。
// 摘要的最后一行都是 IMPORT_UNDO_NOTE（不是醒目行）；存不下导入前的数据就拒绝导入（TOAST_IMPORT_NO_UNDO，6000 ms）；
// 撤销前如果导入之后又有修改，确认框正文先写 CONFIRM_UNDO_CHANGED；确认框打开期间又同步来修改，再弹一次，多一行 CONFIRM_UNDO_MORE（D-05）
export const BTN_UNDO_IMPORT = '撤销导入';
export const IMPORT_UNDO_NOTE = '导入前的数据会在这台设备上留一份，导入后可以撤销。';
export const TOAST_IMPORT_NO_UNDO = '本机空间不够，没能留下导入前的数据，所以没有导入';
export const CONFIRM_UNDO_TITLE = '撤销导入？';
export const CONFIRM_UNDO_CHANGED = '导入之后又有新的修改，撤销会把这些修改一起撤掉。';
export const CONFIRM_UNDO_MORE = '刚才确认的时候又收到了其他设备的修改，撤销也会把它们一起撤掉。';
export const BTN_UNDO_CANCEL = '不撤销';
export const BTN_UNDO_OK = '仍然撤销';
export const TOAST_UNDONE = '已撤销导入，恢复成了导入前的样子';

// Phase 11-06 Task 2：退出确认框在本机还留着导入前的数据时多出的一行（应用里 T_CF_UNDO 的逐字复制），排在账号行、未保存行、留底行之后
export const CONFIRM_LOGOUT_UNDO = '这台设备上还能撤销上一次导入，退出后就不能撤销了。';

// Phase 11-07 Task 1：旧路径（没有账号、不保存计划）拒绝只含计划的文件的提示（应用里 T_IMP_PLAN_LOCAL 的逐字复制，D-10）。
// 旧路径的其余提示不变：确认框用 CONFIRM_IMPORT，接受后用 TOAST_RESTORED，格式错误用 TOAST_IMPORT_BAD_FORMAT，太大用 TOAST_IMPORT_TOO_BIG。
export const TOAST_IMPORT_PLAN_LOCAL = '这个版本不保存计划，只含计划的文件要登录后才能导入';

// Phase 12-01：归档的组和任务在目标页「已归档」区、日面板、时间线、日历 CSV 里的显示（应用里 T_GROUP_UNKNOWN、T_ARCH_MARK、T_ARCH_TASKS、T_ARCH_OPEN、T_ARCH_DONE 和 archStatus、archivedHTML 里文案的逐字复制）。
// 自定义待办找不到所属组时，日面板、时间线、日历 CSV 的组标签写 GROUP_UNKNOWN_LABEL；已归档的组写组名；未归档的组写 P 加序号
export const GROUP_UNKNOWN_LABEL = '未知目标组';
export const ARCHIVED_MARK = '已归档';
export const archivedSummary = (n: number): string => `已归档（${n}）`;
export const ARCHIVED_TASKS_TITLE = '已归档的任务';
export const ORPHAN_TASKS_TITLE = '没有所属目标组的待办';
export const ARCHIVE_STATUS_OPEN = '未完成';
export const ARCHIVE_STATUS_DONE = '已完成';
export const archiveDoneOn = (md: string): string => `已完成于 ${md}`;
export const archiveDueOn = (md: string): string => `截止 ${md}`;

// Phase 12-03 Task 1：编辑计划页的入口、页头、保存栏和保存后的提示（应用里 T_PE_BTN、T_PE_HINT_NONE、T_PE_HINT_DIRTY、T_PE_SAVE、T_PE_SAVING、T_PE_SAVED、T_PE_UNNAMED 和页头静态文字的逐字复制）
export const BTN_PLAN_EDIT = '编辑计划';
export const PE_TITLE = '编辑计划';
export const PE_INTRO = '改动先存在这一页，点「保存计划」才生效；点「放弃这次修改」，计划完全不变。';
export const BTN_PLAN_SAVE = '保存计划';
export const BTN_PLAN_DISCARD = '放弃这次修改';
export const PE_HINT_NONE = '还没有修改';
export const PE_HINT_DIRTY = '有没保存的修改';
export const TOAST_PLAN_SAVED = '计划已保存';
export const PE_UNNAMED = '（未命名）';
export const PE_SAVING = '保存中…';

// Phase 12-03 Task 2：离开编辑页的确认、退出登录的条件行、重新登录的确认（应用里 T_PE_LEAVE_TITLE、T_PE_LEAVE_BODY、T_PE_LEAVE_NO、T_PE_LEAVE_YES、T_CF_PLAN、T_PE_RELOGIN_TITLE、T_PE_RELOGIN_BODY、T_PE_RELOGIN_NO、T_PE_RELOGIN_YES 的逐字复制）
export const PE_LEAVE_TITLE = '放弃没保存的修改？';
export const PE_LEAVE_BODY = '计划页里的修改还没有保存，现在离开会丢失。';
export const BTN_PE_LEAVE_STAY = '继续编辑';
export const BTN_PE_LEAVE_GO = '放弃修改';
export const LOGOUT_LINE_PLAN = '编辑计划页里有没保存的修改，退出后会丢失。';
export const PE_RELOGIN_TITLE = '重新登录？';
export const PE_RELOGIN_BODY = '未保存的计划修改会丢失。';
export const BTN_PE_RELOGIN_STAY = '先不登录';
export const BTN_PE_RELOGIN_GO = '仍然重新登录';

// Phase 12-03 Task 3：编辑页打开期间全局远端更新横幅的无按钮变体，和账号的计划读不出来时的提示与保存后的 toast（应用里 T_REMOTE_PE、T_PE_UNREAD、T_PE_SAVED_UNREAD、T_PE_UNREAD_NOKEEP 的逐字复制）。
// PE_UNREAD 显示在编辑页顶部的 #pe-unread；TOAST_PLAN_SAVED_UNREAD 带「下载留底」按钮（8000 ms）；TOAST_PLAN_UNREAD_NOKEEP（6000 ms）说明留底存不下所以没有保存
export const BANNER_REMOTE_PE = '其他设备有新的修改，保存或放弃计划编辑后会自动更新。';
export const PE_UNREAD = '账号的计划读不出来，这里显示的是示例计划。保存时会先把服务器上那一份存成本机留底。';
export const TOAST_PLAN_SAVED_UNREAD = '计划已保存，原来读不出来的那一份已在本机留底';
export const TOAST_PLAN_UNREAD_NOKEEP = '本机空间不够，没能先留下服务器上原来那一份计划，所以没有保存';

// Phase 12-04 Task 1：编辑页里目标组和任务的字段、添加按钮、空任务提示和读屏句子（应用里 T_PE_ADD_GROUP、T_PE_ADD_TASK、T_PE_TASKS_EMPTY、T_PE_LIVE_ADDED_GROUP、T_PE_LABEL_NAME、T_PE_LABEL_NOTE、T_PE_TASKS_TITLE，逐字相同）
export const BTN_ADD_GROUP = '＋ 添加目标组';
export const BTN_ADD_TASK = '＋ 添加任务';
export const PE_GROUP_TASKS_EMPTY = '这个目标组还没有任务。';
export const PE_LIVE_ADDED_GROUP = '已添加：新的目标组';
export const PE_LABEL_NAME = '名称';
export const PE_LABEL_NOTE = '备注';
export const PE_TASKS_TITLE = '任务';

// Phase 12-04 Task 2：直接移除的 toast、撤销按钮、读屏句子前缀、归档确认的文案（应用里 T_PE_REMOVED、T_PE_UNDO_REMOVE、T_PE_LIVE_RESTORED、T_PE_LIVE_ARCHIVED、T_PE_ARCH_*，逐字相同）
export const TOAST_PE_REMOVED_PREFIX = '已从草稿移除：';
export const BTN_PE_UNDO_REMOVE = '撤销移除';
export const PE_LIVE_RESTORED_PREFIX = '已恢复：';
export const PE_LIVE_ARCHIVED_PREFIX = '已归档：';
export const PE_ARCH_TASK_TITLE = '归档这个任务？';
export const PE_ARCH_GROUP_TITLE = '归档这个目标组？';
export const BTN_PE_ARCH_NO = '不归档';
export const BTN_PE_ARCH_TASK = '归档任务';
export const BTN_PE_ARCH_GROUP = '归档目标组';
export const PE_ARCH_TASK_BODY = '归档后它会变灰，放到目标页底部的「已归档」里，不能再勾选；日历和时间线里的完成记录照常显示。';
export const PE_ARCH_DUE_NOTE = '它在日历上的截止提醒也会先隐藏，恢复后回来。';
export const PE_ARCH_GROUP_BODY = '整组会变灰，放到目标页底部的「已归档」里，自定义待办跟着一起归档；日历和时间线里的完成记录照常显示。';
export const PE_ARCH_RESTORE = '可以在编辑页的「已归档」里恢复。点「保存计划」后生效。';

// Phase 12-04 Task 3：校验错误、卡片头的错误数、提示行的错误数和数量上限（应用里 PE_ERR、T_PE_BAD、T_PE_HINT_ERRORS、T_PE_LIM_GROUPS、T_PE_LIM_TASKS，逐字相同）
export const PE_ERR_GROUP_NAME = '请填写目标组名称';
export const PE_ERR_TASK_TEXT = '请填写任务内容';
export const peBadCount = (n: number) => `有 ${n} 处要改`;
export const peHintErrors = (n: number) => `有 ${n} 处需要修改，已标在对应位置`;
export const PE_LIMIT_GROUPS = '最多 20 个';
export const PE_LIMIT_TASKS = '最多 50 项';

// Phase 12-05 Task 1：编辑页的健身分区（应用里 T_PE_FIT_TITLE、T_PE_FIT_GOAL_TITLE、T_PE_FIT_MIN、T_PE_FIT_MAX、T_PE_FIT_NOTE、T_PE_LIFTS_TITLE、T_PE_ADD_LIFT、T_PE_UNIT_EXAMPLE，逐字相同）和本周健身目标行（应用 renderWeek 里的模板）
export const PE_FIT_TITLE = '健身';
export const PE_FIT_GOAL_TITLE = '每周健身目标';
export const PE_FIT_MIN = '最少';
export const PE_FIT_MAX = '最多';
export const PE_FIT_NOTE = '健身说明';
export const PE_LIFTS_TITLE = '力量项';
export const BTN_ADD_LIFT = '＋ 添加力量项';
export const PE_UNIT_EXAMPLE = '例如 kg、次';
export const weekFitGoalLine = (d: number, a: number, b: number) => `训练 ${d} 天，目标 ${a}～${b} 天`;

// Phase 12-05 Task 2：力量项和健身的校验错误、力量项上限、力量项归档确认（应用里 PE_ERR 的 lname、lunit、ltarget、ldef、fitint、fitorder，T_PE_LIM_LIFTS，T_PE_ARCH_LIFT_TITLE、T_PE_ARCH_LIFT_BODY、T_PE_ARCH_LIFT_YES、T_PE_DEL_LIFT，逐字相同）
export const PE_ERR_LIFT_NAME = '请填写力量项名称';
export const PE_ERR_LIFT_UNIT = '请填写单位';
export const PE_ERR_LIFT_TARGET = '目标值要大于 0';
export const PE_ERR_LIFT_DEF = '起始值不能小于 0';
export const PE_ERR_FIT_INT = '请填 0 到 7 之间的整数';
export const PE_ERR_FIT_ORDER = '最少天数不能大于最多天数';
export const PE_LIMIT_LIFTS = '最多 8 个';
export const PE_DEL_LIFT = '删除这个力量项';
export const PE_ARCH_LIFT_TITLE = '归档这个力量项？';
export const PE_ARCH_LIFT_BODY = '归档后目标页只读显示它的历史，不能再记录新的重量。';
export const BTN_PE_ARCH_LIFT = '归档力量项';

// Phase 12-05 Task 3：基础预设标签分区和标签的校验错误（应用里 T_PE_PRESETS_TITLE、T_PE_PRESETS_NOTE、T_PE_PRESETS_EMPTY、T_PE_ADD_TAG、T_PE_LIM_TAGS、T_PE_TAG_COUNT、PE_ERR 的 tag 与 tagdup，逐字相同）
export const PE_PRESETS_TITLE = '基础预设标签';
export const PE_PRESETS_NOTE = '这里改的是基础标签。在「记一笔」里自己加的标签、隐藏的标签不受影响。';
export const PE_PRESETS_EMPTY = '这个类别还没有基础标签。';
export const BTN_ADD_TAG = '＋ 添加标签';
export const pePresetCount = (n: number) => `${n} 个标签`;
export const PE_ERR_TAG_EMPTY = '请填写标签内容';
export const PE_ERR_TAG_DUP = '这个分类里已经有这个标签了';
export const PE_LIMIT_TAGS = '最多 20 个';

// Phase 12 审查修复 WR-02：保存关口的数量和长度上限错误（应用里 PE_ERR 的 glimit、tlimit、llimit、taglimit、nlong、tlong、ulong、taglong，逐字相同）
export const PE_ERR_GROUP_LIMIT = '目标组最多 20 个，请先删掉或归档多余的';
export const PE_ERR_TASK_LIMIT = '每组最多 50 项任务，请先删掉或归档多余的';
export const PE_ERR_LIFT_LIMIT = '力量项最多 8 个，请先删掉或归档多余的';
export const PE_ERR_TAG_LIMIT = '每个分类最多 20 个标签，请先删掉多余的';
export const PE_ERR_NAME_LONG = '名称最多 40 个字';
export const PE_ERR_TASK_LONG = '任务内容最多 200 个字';
export const PE_ERR_UNIT_LONG = '单位最多 8 个字';
export const PE_ERR_TAG_LONG = '标签最多 30 个字';

// Phase 12-06 Task 1：编辑页底部「已归档」区（应用里 T_PE_AR_SUM、T_PE_AR_H_*、T_PE_AR_RESTORE、T_PE_AR_PURGE、T_PE_LIVE_RESTORED，逐字相同）。
// 摘要和 12-01 目标页的「已归档（n）」同一个写法；恢复的 toast 是「已恢复：」加短名（超过 10 个字截断加 …，只给合成名用）
export const PE_ARCHIVED_TITLE = archivedSummary;
export const BTN_RESTORE = '恢复';
export const BTN_PURGE = '彻底删除';
export const PE_ARCH_GROUPS = '目标组';
export const PE_ARCH_TASKS = '任务';
export const PE_ARCH_LIFTS = '力量项';
export const toastRestored = (name: string): string => {
  const chars = Array.from(name || PE_UNNAMED);
  return `已恢复：${chars.length > 10 ? `${chars.slice(0, 10).join('')}…` : chars.join('')}`;
};

// Phase 12-06 Task 2：彻底删除的三种确认框、读屏句子前缀和恢复的数量上限文字（应用里 T_PE_PG_*、T_PE_LIVE_PURGED、T_PE_AR_LIM 拼出的整句，逐字相同）
export const BTN_PURGE_NO = '不删除';
export const PE_PURGE_LAST = '点「保存计划」后生效，保存之后无法找回；点「放弃这次修改」可以撤回这次删除。';
export const PE_LIVE_PURGED_PREFIX = '已彻底删除：';
export const PE_PURGE_TASK_TITLE = '彻底删除这个任务？';
export const BTN_PURGE_TASK = '彻底删除任务';
export const PE_PURGE_TASK_RECORDS = '日历和时间线里对应的完成记录也会消失。';
export const PE_PURGE_GROUP_TITLE = '彻底删除这个目标组？';
export const BTN_PURGE_GROUP = '彻底删除目标组';
export const PE_PURGE_GROUP_RECORDS = '任务的进度会一起删除，日历和时间线里对应的完成记录也会消失。';
export const pePurgeCustom = (c: number): string => `组里的 ${c} 个自定义待办也会一起删除。`;
export const PE_PURGE_LIFT_TITLE = '彻底删除这个力量项？';
export const BTN_PURGE_LIFT = '彻底删除力量项';
export const PE_RESTORE_LIMIT_GROUPS = '目标组已满（20 个），先删掉一个再恢复';
export const PE_RESTORE_LIMIT_TASKS = '任务已满（50 项），先删掉一个再恢复';
export const PE_RESTORE_LIMIT_LIFTS = '力量项已满（8 个），先删掉一个再恢复';

// Phase 12-06 Task 3：空计划（应用里 T_PE_EMPTY_TITLE、T_PE_EMPTY_BODY、T_PE_SAMPLE_BTN、T_PE_SAMPLE_LOADED、T_GOALS_NO_LIFTS、T_GOALS_NO_GROUPS、T_PE_GROUPS_EMPTY 和 #wkEmpty 的静态文字，逐字相同）
export const PE_EMPTY_TITLE = '计划是空的';
export const PE_EMPTY_BODY = '目标页还没有目标组和力量项。你可以自己建一份，也可以先载入示例计划，再慢慢改。';
export const BTN_LOAD_SAMPLE = '载入示例计划';
export const TOAST_SAMPLE_LOADED = '已载入示例的目标组和力量项，点「保存计划」后生效';
export const GOALS_NO_LIFTS = '还没有力量项，可以在「编辑计划」里添加。';
export const GOALS_NO_GROUPS = '还没有目标组，可以在「编辑计划」里添加。';
export const WEEK_EMPTY_PLAN = '当前计划是空的，这里只统计你记下的内容。可以在「目标」页载入示例计划或编辑计划。';
export const PE_GROUPS_EMPTY = '还没有目标组。';

// Phase 12-07 Task 1：编辑期间别的设备改了计划（D-07、A14）：提示行、#pe-notice、三选一对话框、两个 toast（应用里 T_PE_NOTICE、T_PE_HINT_REMOTE、T_PE_CF_*、T_PE_BACK、T_PE_TAKE、T_PE_OVERWRITE、T_PE_SAVED_KEPT、T_PE_TAKEN，逐字相同）
export const PE_NOTICE = '计划在别的设备上改过了。你的草稿没有变，点「保存计划」时可以选择怎么处理。';
export const PE_HINT_REMOTE = '计划在别的设备上改过了';
export const PE_CONFLICT_TITLE = '计划在别的设备上改过了';
export const PE_CONFLICT_LINES = [
  '你打开编辑页之后，别的设备保存了新的计划。',
  '用我的覆盖：保存你现在这份草稿；别的设备上的那一版会在本机留一份，可以下载。',
  '放弃我的修改，用新版：丢掉你的草稿，改用别的设备上的新计划。',
  '回去继续改：回到编辑页，什么都不变。',
];
export const BTN_PE_BACK = '回去继续改';
export const BTN_PE_TAKE_THEIRS = '放弃我的修改，用新版';
export const BTN_PE_OVERWRITE = '用我的覆盖';
export const TOAST_PLAN_SAVED_KEPT = '计划已保存，别的设备上的那一版已在本机留底';
export const TOAST_PLAN_TAKEN = '已改用别的设备上的新计划，你的修改没有保存';

// Phase 12-07 Task 2：D-08 询问框（应用里 T_PE_D8_* 逐字相同）。项目行的引号里是合成的计划文字，由用例传入
export const PE_D08_TITLE = '这些项刚在别的设备上有了进度';
export const PE_D08_INTRO = '你在草稿里删除了下面这些项，但它们刚在别的设备上有了进度：';
export const PE_D08_QUESTION = '要把它们归档，还是连进度一起删除？';
export const BTN_PE_ARCHIVE_ALL = '全部归档';
export const BTN_PE_DELETE_ALL = '连进度一起删';
export const peD08Task = (text: string, done: boolean): string => `任务「${text}」（${done ? '已完成' : '设了截止日期'}）`;
export const peD08Lift = (name: string, n: number): string => `力量项「${name}」（${n} 条记录）`;
export const peD08More = (n: number): string => `还有 ${n} 项`;

// Phase 12-07 Task 3：保存按钮在过期、断网、容量超限时的提示行（应用里 T_PE_HINT_EXPIRED、T_PE_HINT_OFFLINE、T_PE_HINT_TOOLARGE，逐字相同）
export const PE_HINT_EXPIRED = '登录已过期，重新登录后再保存';
export const PE_HINT_OFFLINE = '联网后再保存';
export const PE_HINT_TOOLARGE = '保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。';
