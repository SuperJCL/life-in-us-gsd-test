# Phase 13: 部署、加固与验收（Deploy, Hardening & Acceptance） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-12
**Phase:** 13-部署、加固与验收（Deploy, Hardening & Acceptance）
**Areas discussed:** 后台入口怎么保护、备份和恢复演练、离线和更新提示
**Areas offered but not selected (decided by recommendation):** 探针站点和总体验收

---

## 选择讨论范围

| Option | Description | Selected |
|--------|-------------|----------|
| 后台入口怎么保护 | 两步验证要发邮件验证码，还是后台关掉公网只经 SSH 进，或 IP 白名单 | ✓ |
| 备份和恢复演练 | 几点备份、留几份；恢复演练在哪里做 | ✓ |
| 离线和更新提示 | 新版本自动换还是提示更新；主屏幕图标和名字 | ✓ |
| 探针站点和总体验收 | 探针页删还是修；重装还是升级；验收清单和搬数据时机 | |

**User's choice:** 后台入口怎么保护、备份和恢复演练、离线和更新提示
**Notes:** 未选的一项按推荐写进决定（D-10..D-13）。

---

## 后台入口怎么保护

### 后台怎么保护

| Option | Description | Selected |
|--------|-------------|----------|
| 后台关掉公网，只从你电脑进 (Recommended) | nginx 屏蔽 /_/，用 SSH 隧道进后台；不用发信邮箱；路线图的两步验证改为“无公网入口 + 强密码” | |
| 公网开放 + 邮件两步验证 | 照路线图做；准备发信邮箱，由所有者本人在后台填写 | ✓ |
| 两个都要 | 只从电脑进，同时开邮件两步验证 | |

**User's choice:** 公网开放 + 邮件两步验证

### 用哪个邮箱发验证码

| Option | Description | Selected |
|--------|-------------|----------|
| 新注册一个只用来发信的邮箱 (Recommended) | 服务器上只存发信专用邮箱的授权码 | |
| 用我现有的邮箱发 | 省一次注册；服务器上存常用邮箱的授权码 | ✓ |

**User's choice:** 用我现有的邮箱发

### 服务器日志

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 7 天，记 IP (Recommended) | 能看到谁在试密码，7 天后自动删 | |
| 保留 2 天，不记 IP | 与 Phase 6 探针相同，隐私最好 | |
| 保留 30 天，记 IP | 排查更方便 | ✓ |

**User's choice:** 保留 30 天，记 IP

---

## 备份和恢复演练

### 备份频率和保留

| Option | Description | Selected |
|--------|-------------|----------|
| 每天一次，留 30 天 (Recommended) | 北京时间凌晨自动做 | ✓ |
| 每天一次，留 7 天 | 最省空间 | |
| 每天两次，留 30 天 | 凌晨和中午各一次 | |

**User's choice:** 每天一次，留 30 天

### 恢复演练在哪里做

| Option | Description | Selected |
|--------|-------------|----------|
| 服务器上的临时实例，在搬真实数据前做 (Recommended) | 从 R2 取回只含测试账号的备份，另一个端口恢复核对后删除 | ✓ |
| 你电脑上的临时实例 | 下载备份到 private/，用本机 PocketBase 恢复 | |

**User's choice:** 服务器上的临时实例，在搬真实数据前做

### 备份失败怎么知道

| Option | Description | Selected |
|--------|-------------|----------|
| 发邮件提醒 (Recommended) | 用同一个发信邮箱，失败或连续两天没有新备份时发邮件 | ✓ |
| 不自动提醒 | 部署说明写明怎么看，所有者定期看 | |

**User's choice:** 发邮件提醒

---

## 离线和更新提示

### 版本更新

| Option | Description | Selected |
|--------|-------------|----------|
| 下次打开自动换新 (Recommended) | 后台悄悄下载，下次完全关掉再打开时生效 | |
| 提示「有新版本，点此更新」 | 页面上提示一行，点了才刷新；有未保存修改时先确认 | ✓ |
| 发现新版就自动刷新 | 可能打断正在写的内容 | |

**User's choice:** 提示「有新版本，点此更新」

### 主屏幕图标和名字

| Option | Description | Selected |
|--------|-------------|----------|
| 名字「计划手记」，简单文字图标 (Recommended) | 纯色底加「记」字，沿用应用配色 | ✓ |
| 我自己提供图标 | 先用文字图标占位 | |

**User's choice:** 名字「计划手记」，简单文字图标

---

## 收尾

| Option | Description | Selected |
|--------|-------------|----------|
| 可以写决定了 | 写进 13-CONTEXT.md 并提交 | ✓ |
| 再讨论探针站点和验收 | 不按推荐，逐项讨论 | |
| 探讨其他问题 | 再找 2–4 个需要定的地方 | |

---

## Claude's Discretion

- USJ_CONFIG 的注入方式、CSP 写法和其他安全响应头、CORS 收紧、nginx 请求体上限
- `deploy/` 模板结构和私有参数变量名、站点检查脚本改造
- 备份时刻和时区、邮件提醒的实现方式
- 更新提示的文案和位置、Service Worker 版本与缓存细节、冷启动离线用例
- 「探针站点和总体验收」整项按推荐定（D-10..D-13）

## Deferred Ideas

- 后台只经 SSH 隧道访问（推荐过、这次没选）
- 单独注册发信专用邮箱（推荐过、这次没选）
- 探针页 CR-01、CR-02（页面删除后不再需要）
