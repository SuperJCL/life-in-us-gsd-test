---
phase: quick-261121-uax
plan: 01
subsystem: fitness
tags: [weight-unit, kg, lb, state-wu, fitness-tab, playwright]
status: complete
requirements-completed: [QUICK-261121-uax]
provides:
  - 健身页 kg | lb 开关，所选单位存在账号 state.wu，随同步、导出、导入走
  - 力量目标卡、记录表、训练历史、趋势图按所选单位显示，用 lb 输入时存成力量项自己的单位且稳定读回
affects: [fitness-tab, backup-import-export, tests/e2e/fitness]
actuals:
  tokens: 17600
  tasks: 3
  commits: 3
plan_head_before: fe02b20d7524a86a74a58b3c2a9ce6ee5cbefa83
plan_head_after: fc0492619269f2e73572e74994799bcb7b5a51f9
key-files:
  created: [tests/e2e/fitness/units.spec.ts]
  modified: [us-journey-tracker.html, tests/support/constants.ts, tests/support/fitness.ts, tests/support/strings.ts, tests/cloud/fitness-sync.spec.ts, tests/README.md]
key-decisions:
  - "单位设置存在 state 顶层字符串 wu，只接受 kg 和 lb，同步键 wu"
  - "state.workouts 格式不变，换算只在输入和显示的边上做（wuIn、flCv、wuMain、fcLift、fcSer）"
completed: 2026-11-22
---

# Quick 261121-uax：健身页重量支持 kg 和 lb

健身页顶部加了一个 `kg | lb` 开关，所选单位同时管输入和显示，存在账号数据的 `wu` 字段里随同步走；`state.workouts` 的格式没变，已有数据一条都没改。没有部署，没有连服务器，新版本上线要另走所有者批准的发布流程。

## 按决定说明做了什么

**[显示方式]** 所选单位大字，另一种单位灰色小字（`.wu-alt`）：
- 力量目标卡的当前值和目标值：`40 kg` 后面跟 `≈ 88.2 lb`，选 lb 时是 `88.2 lb ≈ 40 kg`。
- 记录表：列标题和每组重量的读屏标签用所选单位，动作旁的目标带灰色换算。
- 训练历史：动作名后带单位（例如 `卧推（lb）：55.1 × 5，66.1 × 3`），后面灰色写另一种单位的范围（`≈ 25～30 kg`）。徒手组、次数项和已被计划删掉的动作保持原样。
- 趋势图：坐标刻度、目标线标签、读数行、数据表和读屏标签都只显示所选单位。

**[记录单位]** 一个开关管记录和显示：
- 输入按所选单位理解，保存时换算成力量项自己的单位，`state.workouts` 里的 `w` 仍是两位小数。用 lb 输入 135 存成 61.23，再打开仍然显示 135。
- 在开关上切换单位时，没保存的草稿里每个合格数字跟着换，仍然是「有没保存的内容」，空的和不合格的字符串原样不动。
- 另一台设备改了单位也走同一条路：不刷新，草稿跟着换，焦点在记录区里时按 id 回到原来的输入框。
- 本机草稿留底带上草稿单位 `u`；旧版留底没有 `u`，按「各力量项自己的单位」读，再换成当前单位。

**[设置范围]** 跟账号走：
- `normalize` 只在 `wu` 恰好是 `"kg"` 或 `"lb"` 时保留，其余一律丢掉，没有就按 kg。`LEGACY_KEYS`、`legacyShape`、`classifyBackup` 没动。
- 完整备份的 `state` 带 `wu`，导入时随整份数据替换；旧备份和带非法值（例如 `"LB"`）的备份导入后没有 `wu`，回到 kg。
- 开关是静态标记，没有放进 `GATE_ALLOW`，对账门控期间和其他写入控件一样是 disabled。

## 自行决定的取舍（Discretion）

- **字段**：`state.wu`，顶层字符串，同步键 `wu`，写法同 `commit(["arrival"], ...)`。
- **换算和显示精度**：1 kg = 2.20462262 lb；换算出来的值最多 1 位小数、去掉 `.0`，所以 60 kg 的灰色换算是 `≈ 132.3 lb`（CONTEXT 里的 132 只是示意）。值用力量项自己的单位显示时保持原文字，所以 kg 模式下已有的文字一字不变。
- **输入读回稳定**：输入框显示「换回力量项自己的单位并按两位小数保存后，正好等于现在存储值」的最短小数（0 到 3 位，`wuIn`）。穷举验证：0 到 1000 的每个一位小数 lb（kg 力量项）和 0 到 453.59 的每个两位小数 kg（lb 力量项）原样读回；0 到 1000 的每个两位小数存储值，两个方向「打开再保存」都不变。这条性质写成了默认套件里的用例。
- **接受的边界**：给 kg 力量项输入两位小数的 lb 值时，可能读回成相邻的两位小数，它存的 kg 值相同（0.01 kg 的存储精度比 0.01 lb 粗）。
- **接受的边界**：kg 力量项里存着超过约 453.6 kg 的重量时，切到 lb 后输入框是超过 1000 的数，要先改小才能保存（输入框上限仍是 1000）。
- **图表**：不放灰色小字（读数行每次指针移动都被重写成纯文字，SVG 里也没有位置），只显示所选单位。
- **上次那一行**：记录表里的「上次（日期）：…」只用所选单位的数字，不带灰色换算（它是紧凑的列表，列标题已写了单位）。
- **每组输入框旁不做实时换算**：375 px 下一组一行已经满了。
- **手填历史点**：Phase 15 已经去掉了手填入口；`state.lifts` 里留下的旧手填点在显示的地方（卡片的回落值、图上的点）按所选单位换算显示。
- **目标页和编辑计划页不变**：目标页的归档力量项一行和计划编辑器仍然显示力量项自己的单位，按任务范围没动。
- **容量（vol）**：按所选单位换算，单位文字随之变成 `lb×次`；次数模式和单位不是重量的力量项（例如「次」）完全不变，单位是 lb/lbs 的力量项在选 kg 时反向换算。

## 已知的过渡现象（接受）

还没换到新版本页面的设备，保存一次 state 时旧页面的 `normalize` 会把 `wu` 丢掉，单位设置回到 kg。只影响这个设置，不影响训练数据。

## 测试

- 默认套件：247 条通过（之前 239 条加 8 条新的），`REPORT OK expected=247 flaky=0 unexpected=0`。其中 6 条已知 bug 用例按预期失败，不算在失败里。
- 云端：`fitness-sync.spec.ts` 和 `fitness-log.spec.ts` 共 14 条通过，包含新的两台设备用例。
- 新增 `tests/e2e/fitness/units.spec.ts` 8 条（纯函数、normalize 与备份识别、开关与目标卡、读回性质、lb 输入、历史与图表与 lbs 和次数项、375 px、导出导入）和 1 条云端用例。
- 改过的已有 helper：`readLiftGoals` 的 `target` 不再含 `.wu-alt` 里的换算，并新增 `valueAlt`、`targetAlt`；`strings.ts` 补了新文字的镜像。已有用例的期望值一条没改。
- `APP_SHA256` 最终值：`57be604b520837e7260544eeba026e3be3a4808f64cbb3a11c0e335d8ea908fd`。

## 提交

- `f576926` 开关、纯函数、normalize、力量目标卡（Task 1）
- `b439459` 记录表输入与稳定换算、训练历史、趋势图（Task 2）
- `fc04926` 备份和两台设备用例、README（Task 3）

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. 没有新端点，新字段只走已有的 state 文档、备份和本机缓存；新插进标记的文字都过 `esc()`，转义的源码门槛和恶意计划渲染用例全部通过。

## Self-Check: PASSED

- 文件存在：`tests/e2e/fitness/units.spec.ts`、本 SUMMARY。
- 三个提交都是 HEAD 的祖先；`APP_SHA256` 与应用文件的 sha256 一致。

## 上线（2026-11-22）

- 构建：`node deploy/build-site.mjs` 得到 BUILD_VERSION `f99fb5fa3d7d`（线上旧版本 `84d1fc754072`），`verify-site --check-bundle` 输出 BUNDLE OK (9 checks)。和上次发布的 `SHA256SUMS` 相比只变了 `BUILD_VERSION`、`server/nginx/usj-csp.conf`（页面内联块的哈希）、`site/index.html`、`site/sw.js`；`deploy/` 代码自上次发布以来没改，CSP 的结构不变。
- 批准清单：13 行（`SHA256SUMS` 自身 `4a876d6d…5b51704` 加 06 读取的 `BUILD_VERSION`、`server/06-install-site.sh`、`server/nginx/usj-csp.conf` 和 9 个 `site/` 文件），只运行 06，不运行 03（没有迁移、钩子和环境变量的变化）。命令文件 sha256 `6df38691…0165744`。
- 所有者批准：2026-11-22 06:53 UTC 前后展示清单、四个变化文件的白话说明、六条命令原文和影响说明；所有者回复“批准”，06:54 UTC 开始执行。
- 结果：命令 1、2、5 正常（本机核对 13 行 OK）；命令 3 `UPLOAD_CHECK=ok FILES=13`；命令 4（06）`SITE_VERSION=f99fb5fa3d7d`、`SITE_SWAP=done`、`CSP_CONF=installed`、`CSP_TRANSITION=done`、`NGINX_RELOAD=done`；命令 6 `VERIFY OK (19 checks)`，第一次运行即通过，没有重跑。
- 之后的只读状态：`SITE_VERSION=f99fb5fa3d7d`、`PB_SERVICE_ACTIVE=active`、`PB_HEALTH=ok`、`NGINX_TEST=ok`、`UPLOAD_DIRS=0`。PocketBase 全程没有停，账号数据没有动。
- 所有输出都经过 `tools/privacy/redact.mjs`，`--check` 干净。
