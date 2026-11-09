// cloud 用例共用的合成数据构造函数。只放合成数据，不导入应用，也不抄个人计划文字。

// 合成 state：带 _synthetic 标记和一条合成记录；label 区分不同账号，extra 的字段并进结果。
// 记录日期在冻结周（2026-03-16 到 2026-03-22）内，所以本周视图能看到它。
export function syntheticState(label: string, extra?: Record<string, unknown>) {
  return {
    _synthetic: true,
    logs: [{ id: `synthetic-${label}`, date: '2026-03-17', cat: '语言', text: `合成记录 ${label}` }],
    ...extra,
  };
}

// 大体积合成 state：用中文合成文字（UTF-8 每字 3 字节）凑到 targetBytes 附近，用来触发容量警告和超限。
// 记录日期在冻结周之外，所以不会渲染进本周视图；字节数用 Buffer.byteLength(JSON.stringify(...)) 计算，
// 结果落在 targetBytes 以下、相差不超过 3 字节（一个中文字的宽度）。内容只有 _synthetic 标记和合成记录。
export function bulkyState(label: string, targetBytes: number) {
  const CHUNK = 20000; // 每条记录最多的字数，条数因此是“若干条”而不是一条超大记录
  const logs: Array<{ id: string; date: string; cat: string; text: string }> = [];
  const measure = () => Buffer.byteLength(JSON.stringify({ _synthetic: true, logs }));
  for (let i = 0; ; i += 1) {
    const record = { id: `synthetic-${label}-${i}`, date: '2025-01-05', cat: '语言', text: '' };
    logs.push(record);
    const remaining = targetBytes - measure();
    const chars = Math.min(CHUNK, Math.floor(remaining / 3));
    if (chars <= 0) {
      logs.pop();
      break;
    }
    record.text = '合'.repeat(chars);
    if (chars < CHUNK) break;
  }
  return { _synthetic: true, logs };
}

// 合成个人计划：groupCount 个组，类别依次取 语言、求职、其他（超出后循环），每组两个任务，一个力量项，健身说明和一个预设标签。
// 每一段计划文字（组名、任务、力量项名、健身说明、预设标签）都带 `SYNTH-<label>`，
// 所以对方账号的一个标记 `SYNTH-<label>` 就能在负向断言里覆盖它的全部计划文字。label 只用字母数字。
// id 都符合应用 normalizePlan 的校验：组 g-<label><n>，任务 t-<label><n>x<i>，力量项 l-<label>1。
export function syntheticPlan(label: string, groupCount: number) {
  const cats = ['语言', '求职', '其他'];
  const groups = Array.from({ length: groupCount }, (_, i) => {
    const n = i + 1;
    return {
      id: `g-${label}${n}`,
      cat: cats[i % cats.length],
      name: `SYNTH-${label} group ${n}`,
      tasks: [1, 2].map((t) => ({ id: `t-${label}${n}x${t}`, text: `SYNTH-${label} task ${n}.${t}` })),
    };
  });
  return {
    _synthetic: true,
    v: 1,
    presets: { lang: [`SYNTH-${label} preset`], pro: [], fit: [], job: [], oth: [] },
    groups,
    lifts: [{ id: `l-${label}1`, n: `SYNTH-${label} lift`, unit: 'kg', def: 10, target: 20, note: '' }],
    fitGoal: [1, 3],
    fitNote: `SYNTH-${label} fit note`,
  };
}
