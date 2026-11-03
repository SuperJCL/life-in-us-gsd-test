// 内置任务的位置 id 和力量项目 id（D-05）。
// 这些 `P<n>-<i>` 是内置任务的位置 id，由应用源码里任务的顺序决定（第几组的第几项）：
// 源码里任务顺序变了，它们就会指向别的任务。DATA-01 的页面用例会检查它们在目标页上仍然存在。
// 这里只放 id，不放任务文字（D-14）。

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
