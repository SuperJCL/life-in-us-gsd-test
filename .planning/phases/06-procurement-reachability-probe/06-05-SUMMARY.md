---
phase: 06-procurement-reachability-probe
plan: 05
subsystem: infra
tags: [probe-page, pocketbase-sdk, realtime, vendor, supply-chain, privacy, d-09, d-15, d-17]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-03 的 tools/probe/schema.json 和 schema-check.mjs（上传字段的唯一来源和比对工具）
  - phase: 06-procurement-reachability-probe
    provides: 06-04 的 redact.mjs 过滤器、.gitattributes 里 vendor 目录的 -text 规则、config.js 的 .gitignore 规则
provides:
  - "tools/probe/page/index.html、probe.js、config.example.js：D-09 完整流程的探针页（选运营商和网络 → 首屏 → 登录 → 实时打点 → 上传 → 屏幕摘要），只加载同源相对地址资源"
  - "tools/probe/README.md：运维步骤、批准流程、测量范围、D-05 超级用户命令、给测试人的说明、测试安排"
  - "tools/probe/page/vendor/：PocketBase JS SDK 0.28.1 的 iife 文件、MIT 许可证、SHA256SUMS、vendor/README.md（经所有者批准、完整性核对后放入）"
affects: [06-06, 06-07, 06-09, 06-10]

actuals:
  tokens: 6000
  tasks: 3
  commits: 2
plan_head_before: ef4134586eb94d224120d662a61f8558b9918099
plan_head_after: e35a38abb00fcae190604dcb759e7141e5436d04

tech-stack:
  added: []
  patterns:
    - "探针页：一个 IIFE，不往 window 挂东西；页面文字一律 textContent；可选能力（wakeLock、Paint Timing）用 try/catch 包住；不调用控制台输出接口"
    - "上传字段由常量 RESULT_FIELDS、PING_FIELDS 约束，schema-check.mjs --page 逐项比对 schema.json"
    - "SDK 只作为单个静态文件放在页面旁边，不进 package.json，哈希固定在 SHA256SUMS，文件按原字节保存（vendor/** -text）"
    - "下载不可信包：新建空目录放 tarball，先比对 sha512 和 sha1，一致才解压到另一个新建空目录，只取需要的两个成员，不在那些目录里运行任何东西"

key-files:
  created:
    - tools/probe/page/index.html
    - tools/probe/page/probe.js
    - tools/probe/page/config.example.js
    - tools/probe/README.md
    - tools/probe/page/vendor/pocketbase.iife.js
    - tools/probe/page/vendor/LICENSE.md
    - tools/probe/page/vendor/SHA256SUMS
    - tools/probe/page/vendor/README.md
  modified: []

key-decisions:
  - "实时连接只在登录成功之后才建立；登录失败时直接跳到摘要和上传，上传会失败并提示截图"
  - "实时连不上时打点仍按计划时间发出，收不到推送的记为 null（push_ms 里丢失记 null，与 summarize.mjs 的统计口径一致）"
  - "events 的事件形状为 {k:'drop',t} 和 {k:'reconnect',t,ms}，与 summarize.mjs 的 pairDrops 配对逻辑一致，最多保留 200 条"
  - "上传 = 第一次尝试 + 3 次重试（间隔 2 秒）；仍失败就显示“请截图这一屏”的提示"
  - "结束时调用 pb.authStore.clear()，探针令牌不留在同源的 localStorage 里，避免以后同源上的应用读到它"
  - "打点节奏 15/45/105/195/315/495 秒，最长安静 180 秒：测的是安静不超过 180 秒时的推送丢失；5 分钟空闲断开只能从 drop/reconnect 事件间接看到（README 和 06-10 照此表述）"
  - "SDK 用 0.28.1，不用 0.28.2（D-15）；只在所有者批准后下载，且只下载这一次"

patterns-established:
  - "包合法性检查点（blocking-human）之后才允许下载；完整性值在规划时只读元数据得到，下载后逐字比对"

requirements-completed: [INFRA-02]

coverage:
  - id: D1
    description: "探针页三件套（index.html、probe.js、config.example.js）接通 D-09 全流程，上传字段与 schema.json 一致，只加载同源资源，没有 HTML 字符串接口和控制台调用"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "node --check tools/probe/page/probe.js && node tools/probe/schema-check.mjs --page tools/probe/page/probe.js (SCHEMA MATCH page) + grep 门槛"
        status: pass
    human_judgment: false
  - id: D2
    description: "探针页在真实浏览器和 PocketBase 0.41.1 服务端上的端到端行为（首屏取值、登录、实时打点、上传）"
    requirement: INFRA-02
    verification: []
    human_judgment: true
    rationale: "本机没有服务端，只做了语法和静态检查；真实运行由 06-09 的 verify-site 和所有者 ?dur=90 自测验证"
  - id: D3
    description: "SDK 0.28.1 的 iife 文件经所有者批准、sha512 和 sha1 与 registry 值一致后放入 vendor，SHA256SUMS 校验通过，隐私检查通过"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "cd tools/probe/page/vendor && sha256sum -c SHA256SUMS; git check-attr text (unset); node tools/privacy/privacy-check.mjs --staged"
        status: pass
    human_judgment: false
  - id: D4
    description: "README 的运维步骤、测量范围说明和给测试人的说明是否清楚好用"
    verification: []
    human_judgment: true
    rationale: "文字是否让测试人和所有者看得懂，需要人读过才能判断"

duration: 8min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 05: 探针页与 SDK 0.28.1 Summary

**同源探针页（选运营商 → 首屏 → 真登录 → 实时自写自收打点 → 上传 probe_results → 屏幕摘要）加上经所有者批准、sha512/sha1 核对后固定哈希的 PocketBase JS SDK 0.28.1 单文件，以及运维 README。**

## Performance

- **Duration:** 约 8 分钟（本次续跑；Task 1 由前一个执行者完成）
- **Started:** 2026-11-08T06:18:31Z
- **Completed:** 2026-11-08T06:30Z 前后
- **Tasks:** 3（Task 2 为所有者检查点）
- **Files modified:** 8（全部为新建）

## Accomplishments

- 探针页完整实现 D-09 流程，上传记录只含 `RESULT_FIELDS` 里的 27 个字段，打点只含 `PING_FIELDS`；`schema-check.mjs --page` 输出 `SCHEMA MATCH page`。页面不收集个人信息：没有自由文本输入，UA 只上传粗分类，不上传 IP，摘要不显示主机名。
- README 写明脚本顺序、D-04 批准流程、测量范围（打点之间最长安静 180 秒）、D-05 超级用户命令、给测试人的一页说明和测试安排。
- SDK 0.28.1 经所有者在包合法性检查点批准后下载：tarball（369510 字节）的 sha512 与 sha1 与规划时读到的 registry 值逐字一致，才解压；只解出 `package/dist/pocketbase.iife.js` 和 `package/LICENSE.md`，在新建空目录里完成，没有运行包里任何东西，没有 npm install，没有改 package.json，临时目录已删除。

## 所有者在检查点的回复与完整性核对结果

- 所有者回复：“批准下载 0.28.1 (Recommended)”（只覆盖这一次下载）。
- 完整性：sha512 为 `sha512-/3ihkq+rvfcs0MQgrK4sEElOg6gfenHW9S/O+3BSO+V1yT+4B10+9aT22uTQUPqze9ItwNtwWyY5ZmdgVCTdVA==`，sha1 为 `742f4d1add0b628ddcef109895c2cdbb81167736`，均与检查点中固定的值一致。
- 解压后的 `pocketbase.iife.js`：40539 字节，sha256 为 `94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f`，许可证 MIT。
- 隐私检查：对这 4 个 vendor 文件运行 `node tools/privacy/privacy-check.mjs --staged`，通过（4 个文件，无命中）；`git check-attr text` 显示 `unset`。

## Task Commits

1. **Task 1: tracer——探针页一次接通 D-09 完整流程并写 README** - `f10b4e2`（feat）
2. **Task 2: 包合法性检查点（blocking-human）** - 无提交，所有者批准
3. **Task 3: 下载、核对并固定 SDK 0.28.1** - `e35a38a`（chore）

**Plan metadata:** 见随后的 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）

## Files Created/Modified

- `tools/probe/page/index.html` - 探针页，三个相对地址的 script（SDK、config.js、probe.js）
- `tools/probe/page/probe.js` - D-09 流程、`RESULT_FIELDS`、`PING_FIELDS`、`?dur=`（60–600，默认 600）
- `tools/probe/page/config.example.js` - `window.PROBE_CONFIG` 的 `<…>` 占位
- `tools/probe/README.md` - 运维说明和测试人说明（其中列出的 `server/`、`verify-site.mjs` 由 06-06 至 06-09 创建，已在文中标注）
- `tools/probe/page/vendor/pocketbase.iife.js` - SDK 0.28.1（原字节）
- `tools/probe/page/vendor/LICENSE.md` - MIT 许可证
- `tools/probe/page/vendor/SHA256SUMS` - iife 文件的 sha256
- `tools/probe/page/vendor/README.md` - 版本、来源、完整性值、核对结果、批准记录、更新办法

## Decisions Made

见 frontmatter 的 key-decisions。要点：登录成功后才连实时；实时没连上也照常打点、丢失记 null；事件形状与 summarize.mjs 的配对逻辑一致；上传重试 3 次；结束时清掉 authStore，探针令牌不留在同源 localStorage；SDK 固定 0.28.1。

## Deviations from Plan

None - plan executed exactly as written.

（执行细节：`sha256sum` 默认写出的 SHA256SUMS 带 ` *` 二进制标记，已按计划改写为两个空格的格式，`sha256sum -c` 通过；这不是偏离。）

## Issues Encountered

None。一个小提示：为算哈希临时写了一个脚本放在系统临时目录（不在下载目录内），已与两个下载目录一起删除。

## Known Stubs

None（页面和 README 里没有 TODO、占位文字或写死的空数据流向界面；config.example.js 的 `<…>` 占位是计划要求的）。

## Threat Flags

None（没有超出计划威胁登记表的新网络入口、认证路径或文件访问面）。

## User Setup Required

None - 本计划不需要外部服务配置；真正的 `config.js` 由 06-06 的服务器脚本生成。

## Next Phase Readiness

- 06-06 至 06-09 可以引用 `tools/probe/page/` 和 `vendor/SHA256SUMS`（06-07 的安装脚本和 verify-site 要再核对服务器上的哈希）。
- 仍是假设的部分：页面在真实浏览器和 0.41.1 服务端上的行为、SDK 0.28.1 与服务端 0.41.1 的兼容性（只按接口范围推断），要到 06-09 的 verify-site 和所有者 `?dur=90` 自测才验证；微信内置浏览器可能取不到 FCP，已回退到 DCL。

## Self-Check: PASSED

- 8 个文件均存在；`sha256sum -c SHA256SUMS` 通过；`node --check`、`schema-check --page`、静态门槛（无 http(s) 地址、无 innerHTML、无 console）通过。
- 提交 `f10b4e2`、`e35a38a` 均在 HEAD 的祖先链上；`git rev-list --count` 实测为 2。

---
*Phase: 06-procurement-reachability-probe*
*Completed: 2026-11-08*
