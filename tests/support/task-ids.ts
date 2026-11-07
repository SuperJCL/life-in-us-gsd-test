// 内置任务的 id 和力量项目 id（D-05）。
// 内置任务 id 自 Phase 7 起冻结：它们写在应用的 DEFAULT_PLAN 里，是显式的 `P<n>-<i>` 字面量，
// 不再随任务顺序变化（PLAN-05）。用户已保存的完成和截止状态靠这些 id 对回任务，所以改它们等于把进度挪到别的任务上。
// DATA-01 和 PLAN-05 的页面用例会检查它们在目标页上仍然存在。
// 这里只放 id 和个数，不放任务文字（D-14）。

// 完整 fixture 用到的内置任务 id，键名表示该任务在 fixture 里扮演的状态
export const BUILTIN_TASK_IDS = {
  done: 'P1-1',
  overdue: 'P1-2',
  dueToday: 'P2-1',
  dueFuture: 'P2-2',
  doneToday: 'P3-1',
} as const;

// 力量项目的 id；只是 id，名称和目标数值不写进仓库
export const LIFT_IDS = ['bench', 'squat'] as const;

// 内置目标组（P1 到 P7）各自的任务个数：第 n 组的任务 id 依次是 P<n>-1 到 P<n>-<个数>（PLAN-05）
export const BUILTIN_GROUP_SIZES = { P1: 5, P2: 12, P3: 7, P4: 4, P5: 4, P6: 5, P7: 1 } as const;

// 全部四个力量项的 id，顺序与目标页上力量卡的顺序一致（PLAN-05）
export const ALL_LIFT_IDS = ['bench', 'squat', 'dead', 'pull'] as const;
