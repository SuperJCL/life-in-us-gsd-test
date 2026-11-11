---
status: testing
phase: 11-export-import-migration
source: [11-VERIFICATION.md]
started: 2026-11-11T18:30:00Z
updated: 2026-11-11T18:30:00Z
---

## Current Test

number: 1
name: 在真实 Edge 里用合成文件走一遍迁移演练（摘要、导入、各视图、撤销）
expected: |
  摘要写明文件类型、替换范围和各项计数；手机宽度上文字完整换行、按钮可点；导入后记录、复盘、完成的任务和力量历史都在对的任务和日期上；撤销后回到导入前，“撤销导入”按钮消失
awaiting: user response

## Tests

### 1. 在真实 Edge 里用合成文件走一遍迁移演练（摘要、导入、各视图、撤销）
expected: 运行 `node tools/plan/migrate-backup.mjs --demo`（只写合成文件），打开云端版（合成账号），桌面宽度和手机宽度（375）各一遍，选 `synth-migrated.json`，读摘要，导入，看目标页、日历、时间线、力量历史，再点“撤销导入”。摘要写明文件类型、替换范围和各项计数；手机上文字完整换行、按钮可点；导入后数据在对的任务和日期上；撤销后回到导入前，“撤销导入”按钮消失
result: [pending]

### 2. 在真实 Edge 里下载“备份”和“导出日历 CSV”
expected: 两个文件都能正常保存，文件名不含邮箱；日历 CSV 只是备用导出，不做日历导入检查（所有者 2026-11-10 的决定）
result: [pending]

### 3. 375 px 手机宽度下的工具栏换行和暗色主题外观
expected: 工具栏的按钮全部显示、不挤出屏幕；暗色主题下摘要的醒目行和“撤销导入”入口对比度够用（编排者已在手机尺寸模拟下截图给所有者看过，但模拟不是真机）
result: [pending]

### 4. 手机真机上下载备份和日历 CSV，以及导入时选择文件
expected: 手机浏览器能下载两个文件，导入时能选到备份文件（按 11-CONTEXT，真机检查留给 Phase 13 部署之后）
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
