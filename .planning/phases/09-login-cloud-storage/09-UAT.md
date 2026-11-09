---
status: testing
phase: 09-login-cloud-storage
source: [09-VERIFICATION.md]
started: 2026-11-09T11:30:00Z
updated: 2026-11-09T11:30:00Z
---

## Current Test

number: 1
name: 深色主题下的登录页、横幅和退出确认框
expected: |
  在深色主题（prefers-color-scheme: dark）下打开登录页，触发各类横幅（对账中、网络较慢、连不上、容量警告、本机空间不够）和退出确认框：文字对比度足够，info / warn / error 三种色调能区分，确认框和登录卡片与四个视图的深色风格一致。
awaiting: user response

## Tests

### 1. 深色主题下的登录页、横幅和退出确认框
expected: 文字对比度足够，info / warn / error 三种色调能区分，确认框和登录卡片与四个视图的深色风格一致
result: [pending]

### 2. 375 px 宽下最长的提示（UI-SPEC E4）
expected: 制造一次真冲突，冲突提示加“下载留底”按钮完整显示、可以换行，按钮仍然可点
result: [pending]

### 3. 375 px 宽下的容量警告横幅（UI-SPEC E10）
expected: 数据超过 70% 时，横幅文字自动换行，按钮折到下一行，不挤压文字
result: [pending]

### 4. 真实浏览器里下载留底（D-10）
expected: 在 Edge 里点“下载留底”能得到一个不含账号标识的 JSON 文件；取消保存框时留底按 D-10 已经删除（所有者已知并接受）
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
