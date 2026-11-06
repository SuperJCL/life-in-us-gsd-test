# Phase 7: 计划外置、稳定 id 与转义（Plan Extraction, Stable IDs & Escaping） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-06
**Phase:** 07-id-plan-extraction-stable-ids-escaping
**Areas discussed:** 示例计划写什么、哪些原文算个人内容、坏数据怎么处理、提取出的计划怎么用

**How it went:**
1. Claude 列出 4 个待定问题，让所有者选要讨论哪几个。所有者回答“没有偏好”。
2. Claude 为每个问题给出一条建议，并说明理由。
3. 所有者一次性确认：“可以，照这样定”。

---

## 示例计划写什么

| Option | Description | Selected |
|--------|-------------|----------|
| 占位字 | 写成“示例目标组 1”“示例任务 1”这种 | |
| 通用、像样的例子 | 覆盖同样的几块，措辞与原文完全不同；力量目标换成通用整数，去掉与体重挂钩的备注 | ✓ |

**User's choice:** 接受建议。
**Notes:** 克隆的人和以后的新账号都会看到这份示例，用占位字太空洞。

---

## 哪些原文算个人内容

| Option | Description | Selected |
|--------|-------------|----------|
| 全部改写，不设放行名单 | 看起来通用的预设标签也一律改写，隐私检查保持最严格 | ✓ |
| 保留通用标签并放行 | 在隐私检查里给通用词条开豁免 | |

**User's choice:** 接受建议。
**Notes:** 不受影响的只有类别名、`LEGACY` 旧类别名和两三个字的通用动作名。

---

## 坏数据怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| 导入整份拒绝，读取自动修正 | 导入时有坏条目就整份拒绝、数据不动；读取本机已存数据时修正 id 和字段，记录文字一条不删 | ✓ |
| 跳过坏条目 | 只导入合格的条目，并提示跳过了几条 | |
| 一律整份拒绝 | 读取时也整份拒绝，代价是页面变空，下次保存还可能覆盖原有数据 | |

**User's choice:** 接受建议。
**Notes:** 前提是 v1 的 154 条用例结果不变。如果和 v1 畸形导入用例的现有行为冲突，先保持 v1 行为，推迟到 Phase 11 再改。

---

## 提取出的计划怎么用

| Option | Description | Selected |
|--------|-------------|----------|
| 只给隐私检查和以后搬进账号用 | 本机打开应用时仍显示示例计划 | ✓ |
| 也能在本机显示自己的计划 | 额外做一个本地加载入口 | |

**User's choice:** 接受建议。
**Notes:** 所有者目前实际使用托管的 Claude Artifact，云端版上线前不受影响。改动前，原应用文件另存一份到 `private/`。

---

## Claude's Discretion

- 示例计划的具体文字
- 种子文件的文件名和格式
- 提取工具的位置
- id 白名单正则
- 读取时的具体修正规则
- sha256 基线机制怎么改造

## Deferred Ideas

- 本地显示自己计划的入口：不做，由云端账号取代
- 归档行为：Phase 12
- 去掉 Google 字体：Phase 9
- 导入前的格式识别、摘要、快照和撤销：Phase 11
- 新账号是否另给一份更小的示例：Phase 9
- CSV 公式注入：CONC-F1
