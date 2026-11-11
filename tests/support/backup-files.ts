// 合成导入文件的构造函数（Phase 11）。只用合成数据：文字都以 SYNTH- 开头，不抄任何个人文字，
// 文件只在内存里构造（配合 import-file.ts 的 jsonImportFile 使用，文件名以 synth- 开头）。
// 这里不导入应用代码，也不读应用源码；期望值由用例独立写出。
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, BACKUP_KIND_PLAN } from './constants';

// 一份新的合成旧备份：原 Artifact 导出的裸 state（七个字段齐全，没有计划）。
// - 两条记录：一条在冻结周 2026-03-17（本周视图可见），一条在 2026-02-10；
// - 一条完成的自定义待办 c-<label>-1 和它的进度，再加示例计划里内置任务 P2-1 的完成进度（两条进度 done 为真）；
// - 一个力量项 bench，两条历史；一周复盘；一组预设标签。
// extra 的字段并进结果（同名字段整个替换）。label 只用字母和数字，用来区分不同用例的文件。
export function legacyBackup(label: string, extra: Record<string, unknown> = {}) {
  return {
    _synthetic: true,
    arrival: '2026-01-12',
    logs: [
      { id: `synth-${label}-1`, date: '2026-03-17', cat: '语言', text: `SYNTH-${label} week record` },
      { id: `synth-${label}-2`, date: '2026-02-10', cat: '专业', text: `SYNTH-${label} older record` },
    ],
    custom: [{ id: `c-${label}-1`, group: 'P2', text: `SYNTH-${label} custom task` }],
    tasks: {
      'P2-1': { done: true, doneDate: '2026-03-02' },
      [`c-${label}-1`]: { done: true, doneDate: '2026-03-03' },
    },
    lifts: {
      bench: {
        cur: 60,
        hist: [
          { date: '2026-03-01', v: 55 },
          { date: '2026-03-08', v: 60 },
        ],
      },
    },
    reviews: { '2026-03-16': `SYNTH-${label} review` },
    presets: { lang: { add: [`SYNTH-${label} preset`], hide: [] } },
    ...extra,
  };
}

// 新格式的备份文件（11-02 起，格式见 11-02-SUMMARY 的“备份格式决定”）。按约定的键序独立构造，不调用应用代码；
// plan 是计划对象（例如 cloud-data.ts 的 syntheticPlan），state 是裸记录（例如 legacyBackup 的结果），exportedAt 只作参考。
export function fullBackup(plan: unknown, state: unknown, exportedAt = '2026-03-18T12:00:00.000Z') {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, kind: BACKUP_KIND_FULL, exportedAt, plan, state };
}

// 只含计划的文件：没有 state 键。
export function planOnlyFile(plan: unknown, exportedAt = '2026-03-18T12:00:00.000Z') {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, kind: BACKUP_KIND_PLAN, exportedAt, plan };
}
