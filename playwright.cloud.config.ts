import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// cloud 测试入口：只展开基础配置，改 testDir 和 workers。
// 配置文件在 runner 进程里求值，worker 继承环境变量，所以在这里设置 USJ_TEST_MODE 就够了，
// 不需要 cross-env，Windows 的 cmd 和 PowerShell 都不用特殊写法。
process.env.USJ_TEST_MODE = 'cloud';

export default defineConfig({
  ...base,
  testDir: './tests/cloud',
  workers: 1,
});
