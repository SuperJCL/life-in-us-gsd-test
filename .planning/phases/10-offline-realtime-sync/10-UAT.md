---
status: testing
phase: 10-offline-realtime-sync
source: [10-VERIFICATION.md]
started: 2026-11-10T17:47:38Z
updated: 2026-11-10T17:47:38Z
---

## Current Test

number: 1
name: 两台真实设备上“几秒内”同步，以及写草稿时远端更新先挂起
expected: |
  设备 A 记一笔后几秒内出现在设备 B 上；B 正在写草稿时，先出现“其他设备有新的修改，稍后会自动更新。”横幅，草稿不丢，空闲后才应用。
  注意：真实网络延迟只能在部署到服务器后用真机量（按 10-CONTEXT 和 ROADMAP 归 Phase 13 的真机验收）；本阶段的机制已由假服务器用例证明。
awaiting: user response

## Tests

### 1. 两台真实设备上“几秒内”同步，以及写草稿时远端更新先挂起
expected: 在两台真实设备（一台在中国大陆网络，一台在美国网络）上登录同一个账号，设备 A 记一笔，B 几秒内出现这条记录；B 正在文本框里写草稿时重复一次，先出现“其他设备有新的修改，稍后会自动更新。”横幅，草稿不丢，空闲后才应用。真实网络延迟（国内到香港往返约 300–400 毫秒、SSE 经过 nginx）只能在真机上量，归 Phase 13 的真机验收
result: [pending]

### 2. 状态栏在“没有待上传修改”时的文案（所有者决定）
expected: 本机是干净的、只是后台拉取失败（断网或服务器报错）时，状态栏现在显示“离线，修改已存在本机，联网后自动上传”或“保存失败，修改仍在本机，N 秒后自动重试”。所有者选择：A) 保持现状（逐字沿用 09-UI-SPEC 的 S2，没有任何修改丢失）；B) 先在契约里加入“无修改”的中性文案，再改代码和用例
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
