// 纯常量，不导入任何东西；配置、fixture 和用例都从这里取值。

// 静态服务器端口（D-14）
export const PORT = 4789;

// 应用的来源，guard 只放行这个来源（D-16）
export const APP_ORIGIN = 'http://127.0.0.1:4789';

// 被测应用的文件名，在仓库根目录，Phase 7 起随仓库提供；所有者的原计划只在本机的 private/plan-seed.json（D-10）
export const APP_FILE_NAME = 'us-journey-tracker.html';

// 应用写入 localStorage 的键（本地模式）
export const STATE_KEY = 'us-journey-tracker-v1';

// 冻结的“现在”：2026-03-18 12:00 UTC（D-15）
export const FROZEN_NOW = Date.UTC(2026, 2, 18, 12);

// 冻结时间在 America/New_York 时区下对应的本地日期
export const FROZEN_TODAY = '2026-03-18';

// 浏览器时区，保证日期计算与机器时区无关（D-15）
export const TIMEZONE_ID = 'America/New_York';

// 浏览器语言（D-15）
export const LOCALE = 'zh-CN';

// 字体主机：请求直接 abort，并记为“已预期拦截”（D-16）
export const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// 死代理：本机一个没有服务监听的端口，所有非回环流量只能连到这里（D-16）
export const DEAD_PROXY_SERVER = 'http://127.0.0.1:9';

// 只有回环地址绕过死代理，其余地址一律不放行（D-16）
export const PROXY_BYPASS = '127.0.0.1,localhost';

// 应用文件的 sha256 基线（SAFE-02）。Phase 7 起应用可以改，但每次改应用都要在同一次提交里
// 有意识地更新这个基线；没更新时 SAFE-02 会失败。
export const APP_SHA256 = '46d294421c83ddeb3636430164f55968b5701453a7826d63c30e76d1c3b284d8';

// 合成数据标记：tests/fixtures 下的每个文件都必须带它（SAFE-03）
export const SYNTHETIC_MARKER = '_synthetic';

// 账户模式用的合成用户 id（D-06）
export const ACCOUNT_USER_ID = 'synth-user-0001';

// 账户模式下应用读写的文档路径：data/users/<id>/state（D-06）
export const ACCOUNT_DOC_PATH = `data/users/${ACCOUNT_USER_ID}/state`;

// Node 侧 MockBackend 通过 exposeBinding 暴露给页面的 binding 名（D-01）
export const MOCK_BINDING_NAME = '__claudeMockBackend';

// 固定的“本周”起点：冻结日 2026-03-18 所在周的周一（D-05）
export const WEEK_START_FROZEN = '2026-03-16';

// 固定的“本周”终点：同一周的周日（D-05）
export const WEEK_END_FROZEN = '2026-03-22';

// 合成数据里的抵达日期（D-05）
export const ARRIVAL_DATE_FIXTURE = '2026-01-12';

// mock 和 tests/mocks/CONTRACT.md 对齐的 Claude Artifact 运行时契约版本（MOCK-06）；契约升级时和 CONTRACT.md 一起改
export const CLAUDE_CONTRACT_VERSION = '0.2.96';

// 同源提供真实 PocketBase SDK 的路径：静态服务器从 tools/probe/page/vendor/ 读原文件，不复制第二份（08-02）
export const PB_SDK_PATH = '/vendor/pocketbase.iife.js';

// 页面里运行的 SDK 版本，和 tools/probe/page/vendor/README.md 一致
export const PB_SDK_VERSION = '0.28.1';

// SDK 文件的 sha256 钉死值，和 tools/probe/page/vendor/SHA256SUMS 一致；静态服务器启动时核对
export const PB_SDK_SHA256 = '94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f';

// 假服务器所复述的 PocketBase 服务端版本
export const PB_SERVER_VERSION = '0.41.1';

// 页面侧假 EventSource 经 context.exposeBinding 往返 Node 的 binding 名
export const PB_ES_BINDING_NAME = '__pbFakeEventSource';

// 用户令牌有效期（秒）：90 天，和 users 迁移里的 authToken.duration 一致
export const PB_TOKEN_DURATION_S = 7776000;

// journey_docs.data 的上限（字节）：和 journey_docs 迁移里的 maxSize 一致
export const PB_DOC_MAX_BYTES = 4194304;

// users 认证集合的固定 id，令牌载荷里的 collectionId 用它
export const PB_USERS_COLLECTION_ID = '_pb_users_auth_';

// 备份文件的包装格式（Phase 11，所有者在 11-02 Task 1 确认，one-way）：应用源码逐字复制，见 11-02-SUMMARY 的备份格式决定
export const BACKUP_APP = 'us-journey-tracker';
export const BACKUP_FORMAT = 2;
export const BACKUP_KIND_FULL = 'full';
export const BACKUP_KIND_PLAN = 'plan';
