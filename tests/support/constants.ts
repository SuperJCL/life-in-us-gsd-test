// 纯常量，不导入任何东西；配置、fixture 和用例都从这里取值。

// 静态服务器端口（D-14）
export const PORT = 4789;

// 应用的来源，guard 只放行这个来源（D-16）
export const APP_ORIGIN = 'http://127.0.0.1:4789';

// 被测应用的文件名，只在仓库根目录，不进 git（D-10）
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
