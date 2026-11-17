---
status: complete
phase: 13-deploy-hardening-acceptance
source: [13-VERIFICATION.md]
started: 2026-11-17T20:27:39.342Z
updated: 2026-11-17T23:36:38.233Z
---

## Current Test

[testing complete]

## Tests

### 1. 设备甲（升级前已打开过应用）回到应用，看更新提示，再点「点此更新」（13-ACCEPTANCE E-1 至 E-3）
expected: 出现「有新版本」和「点此更新」，点之前页面不自己刷新；有草稿时先弹确认框；确认后刷新一次，记录都在，缓存换成新版本 0ba1339903f1
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 2. 手机冷启动离线：打开过一次后开飞行模式，关掉所有标签页或从主屏幕重新进入，再记一笔，然后恢复联网（C-1 至 C-4）
expected: 能进入应用，状态行显示本机待上传的数量；联网后自动上传，另一台设备几秒内看到
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 3. 把应用添加到主屏幕（D-1 Android、D-2 iPhone）
expected: 名称「计划手记」，深色底白色「记」字图标，从主屏幕打开是独立窗口；iPhone 的 7 天清理提醒读得明白
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 4. R2 次日回看和演练残留（I-4、K-2）
expected: R2 里持续出现新的 @auto_pb_backup_ 文件，邮箱没有备份失败或「计划手记：备份异常」的信；R2 里没有 drill_ 开头的演练备份
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 5. 后台超级用户口令强度、退出后再登录（I-1，可选 I-2）
expected: 走完「口令、邮件码」两步；故意错几次很快被限流
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 6. 接近上限的合成大文件在真实线路上保存一次（F-4，RESEARCH A11）
expected: 保存成功，另一台设备能看到；出现容量提醒属正常
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

## Summary

total: 6
passed: 0
issues: 0
pending: 0
skipped: 6
blocked: 0

## Gaps

None. 13-VERIFICATION.md 写明：9/9 项的自动化部分全部通过，没有缺口；上面 6 项是推迟的真机和所有者本人检查。

## Deferred Follow-Ups

```yaml
- test: 1
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 2
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 3
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 4
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 5
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 6
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
```
