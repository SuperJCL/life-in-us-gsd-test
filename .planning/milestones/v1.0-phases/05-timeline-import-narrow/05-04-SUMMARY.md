---
phase: 05-timeline-import-narrow
plan: 04
subsystem: testing
status: complete
tags: [known-bugs, import, test-fail, probe, registry, playwright, account-mock]

requires:
  - phase: 05-timeline-import-narrow
    provides: "05-02 的 import-file.ts（jsonImportFile、chooseImportFile、answerNextDialog、recordDialogs）、CONFIRM_IMPORT、TOAST_IMPORT_BAD_FORMAT"
  - phase: 03-composer-editor-week
    provides: "knownBug、成对用例和登记护栏的写法（B1、B4、N1）"
provides:
  - "tests/e2e/platform/probes.spec.ts：PROBE-8，取消导入后用 setInputFiles 再选同一个文件的 spike，断言写死"
  - "tests/e2e/io/known-bugs.spec.ts：B2 的对照、reset path、test.fail 标记用例；N3 的对照、test.fail 标记用例"
  - "tests/KNOWN-BUGS.md：B2、N3 两行登记（登记护栏双向通过）；tests/PROBES.md：PROBE-8 的结论，范围改为 PROBE-1 到 PROBE-8"
  - ".planning/ROADMAP.md：Phase 5 Notes 里 N3 一条按用户 2026-11-03 的决定更正"
affects: [phase-05]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: feb18874ad618c42f96d39a36308617c2278525b
plan_head_after: 17506b129391b18b23885217dc4813d9967de2e9

tech-stack:
  added: []
  patterns:
    - "B2 的期望断言只用确定性的 #importJson value，不写“change 会再次触发”（PROBE-8 证明 Playwright 复现不了）"
    - "N3 的期望断言选“出现格式错误 toast”：正向、自带同步点；“记录仍在页面上”会提前成立，“保存的状态里记录仍在”修好后永远不成立"
    - "每条标记用例先临时去掉 knownBug、--retries=0 只跑本 spec 亲眼复现，再恢复标记"

key-files:
  created:
    - tests/e2e/io/known-bugs.spec.ts
  modified:
    - tests/e2e/platform/probes.spec.ts
    - tests/PROBES.md
    - tests/KNOWN-BUGS.md
    - .planning/ROADMAP.md

key-decisions:
  - "B2 复现并标 test.fail：取消路径的 return 在 e.target.value 清空之前，value 保持不变；期望只断言 value 为空字符串"
  - "N3 复现并标 test.fail（用户 2026-11-03 决定算已知 bug，D-02）；期望只断言格式错误 toast"
  - "两个已知 bug 都没有用 test.fixme，也没有出现“未复现、已删除”的情况，所以完整套件的 --min-expected 仍是 150"

requirements-completed: [IO-04]

coverage:
  - id: D1
    description: "PROBE-8：取消导入后 change 计数 1、value 仍是 fakepath 形式加合成文件名；第二次选同一个文件 change 计数 2、确认框再次出现（断言写死）"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-8 re-selecting the same file with setInputFiles after a cancelled import"
        status: pass
    human_judgment: false
  - id: D2
    description: "B2 一组：对照（确认框文案等于 CONFIRM_IMPORT、没有 toast、fixture 记录仍在、没有写入）、reset path（非 JSON 文件后 value 为空、没有对话框）、test.fail 标记用例；并登记"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts#BUG-01 B2 control: cancelling the import confirm shows the confirm text and leaves the data unchanged"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts#BUG-01 B2 reset path: the file input is cleared after a file that is not JSON"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts#BUG-01 B2 expected: the file input is cleared after cancelling the import confirm"
        status: pass
    human_judgment: false
  - id: D3
    description: "N3 一对：对照证明导入 {} 走到替换确认（文案等于 CONFIRM_IMPORT），test.fail 标记用例断言格式错误 toast；并登记，ROADMAP Notes 按用户决定更正"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts#BUG-01 N3 control: importing an empty JSON object reaches the import confirm"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts#BUG-01 N3 expected: importing an empty JSON object is rejected with the format error"
        status: pass
    human_judgment: false

duration: 约 30 min
completed: 2026-11-04
---

# Phase 5 Plan 4: 导入的已知 bug（B2、N3）Summary

**先用 PROBE-8 证明 Playwright 复现不了“再选同一个文件没反应”，所以 B2 只断言确定性的 #importJson value；B2 和 N3 都先去掉标记亲眼复现，再按成对用例标 test.fail 并登记；完整套件 150 条通过、0 flaky。**

## Accomplishments

- tracer（提交 `e13e3ac`）：PROBE-8 的 spike、B2 一组三条用例、KNOWN-BUGS.md 的 B2 行、PROBES.md 的结论一次打通，登记护栏双向通过。
- 提交 `17506b1`：N3 一对用例和登记行；ROADMAP Phase 5 Notes 里 N3 一条改为用户 2026-11-03 的决定（05-CONTEXT 的 D-02）；KNOWN-BUGS.md“以后的阶段”里 Phase 5 一行改为已登记。
- 完整套件（低优先级、单 worker，本计划唯一一次）：150 条 expected、0 flaky、0 unexpected，`check-report.mjs --min-expected 150` 输出 `REPORT OK`；本计划六个标题、登记护栏和 SAFE-02 都实际运行并通过。

## 观察值与复现记录

- **PROBE-8 的观察值：** 取消导入确认后 change 计数 1；`#importJson` 的 value 没有清空，形式是浏览器的 fakepath 形式加合成文件名；第二次用 `setInputFiles` 选同一个文件，change 计数 2、确认框再次出现。与计划的预期一致（Playwright 每次都自己派发 change），所以用户在真实浏览器里遇到的现象在这里复现不了，B2 的期望断言用 value。断言是写死的（1、fakepath 形式加合成文件名、确认框出现、2），不随观察值改写。
- **B2 去掉标记后：** 对照用例和 reset path 都通过，标记用例失败在 `toHaveValue('')`：实际值是浏览器的 fakepath 形式加合成文件名，不是空字符串。已复现，恢复标记，最终是 `test.fail`。
- **N3 去掉标记后：** 对照用例通过（导入 `{}` 走到了替换确认），标记用例失败在格式错误 toast 的断言（5 秒内没有出现期望文案）。toast 的 helper 按 D-14 隐藏实际内容，所以失败输出里看不到“已恢复”这几个字；“实际出现的是已恢复”由对照用例（确认框出现，说明 normalize 通过）加应用的处理流程推出，不是失败输出里直接看到的。已复现，恢复标记，最终是 `test.fail`。
- 两个都没有用 `test.fixme`，也没有“未复现、已删除”。

## 与计划的差异

None - plan executed exactly as written.

- 一处实现细节：PROBE-8 里“第二次确认框没出现”的 catch 分支只吞掉 poll 的超时、让下面写死的断言去失败，没有采用计划里“改用哨兵文件”的备选，因为实际观察到 change 再次派发，备选分支不适用。
- 一处操作失误已纠正：写 PROBES.md 时 shell 引号吞掉了反引号内的文字，发现后用文件重写那几行，提交前已核对。

## 隐私与保护路径

- 导入文件只在内存里构造，文件名都以 synth- 开头（grep 确认）；PROBES.md、KNOWN-BUGS.md、spec 注释和本 SUMMARY 只写“浏览器的 fakepath 形式加合成文件名”，没有带盘符的字符串（grep 确认）。
- 两次提交都经过隐私钩子并通过，没有绕过；没有新增依赖，没有运行安装命令，只用了 `npm test` 和 `node` 脚本。
- tests/fixtures、tests/support/test.ts、tests/support/app.ts、tests/mocks、playwright.config.ts、package.json、package-lock.json 的 HEAD 对象哈希与计划开始前相同，工作区无改动；`us-journey-tracker.html` 未被跟踪。
- 新 spec 只从 tests/support/test.ts 导入 test、expect、knownBug 和类型；SUMMARY 里没有内置任务、预设或力量项目的原文。

## 假设（有意不验证的边界）

- `[]` 和字段类型错误的对象与 N3 同类（同样能通过 normalize），没有单独验证；N3 只用 `{}`。
- N3 的期望只断言格式错误提示；“不弹确认”和“数据不变”写在期望行为里，没有另写标记用例。
- 用户在真实浏览器里遇到的“再选同一个文件没有反应”本身没有被自动化复现，B2 验证的是它的确定性原因（取消后 input 的 value 没清空）。

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

Ready for 05-03（窄屏）；KNOWN-BUGS.md“以后的阶段”一节的整体改写留给 05-03（D-15 的后半）。

## Self-Check: PASSED

- FOUND: tests/e2e/io/known-bugs.spec.ts、本 SUMMARY 引用的其余文件
- FOUND: e13e3ac、17506b1（均为 HEAD 的祖先）
- 完整套件 150 条通过、0 flaky；保护路径不变量检查通过
