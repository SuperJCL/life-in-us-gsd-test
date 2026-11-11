// Phase 11-11 的合成迁移演练（IO-09，D-06、D-08）：只在 npm run test:cloud 里运行，只用合成数据和假服务器。
// 演练用迁移脚本的 --demo 模式生成合成旧备份、合成种子计划和合成好的新格式文件，输出目录在 test-results/ 下，用例结束就删除；
// 用例从不运行脚本的默认模式和 --plan-only（它们会读 private/ 里的真实文件），只运行 --demo 和 --self-test。
// 期望值由用例从合成旧备份和合成种子独立算出，不调用脚本的函数。
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { confirmOk, readConfirm } from '../support/confirm';
import { expectedCategory, expectedNormalize, expectedTimeline, liftHistoryText } from '../support/expect-from-fixture';
import { gotoGoals, liftHistoryEquals, readGroups } from '../support/goals';
import { chooseImportFile, textImportFile } from '../support/import-file';
import { gotoTimeline, readTimeline } from '../support/timeline';
import { expectToast } from '../support/toast';
import {
  BTN_UNDO_IMPORT,
  CONFIRM_IMPORT_TITLE,
  FILTER_ALL,
  IMPORT_KIND_FULL,
  IMPORT_REPLACE_FULL,
  IMPORT_UNDO_NOTE,
  TOAST_IMPORTED,
  TOAST_UNDONE,
  importCurrentLine,
  importLogsLine,
  importMoreLine,
  importPlanLine,
} from '../support/strings';

const SCRIPT = 'tools/plan/migrate-backup.mjs';
const readJsonFile = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
const lastLine = (out: string) => out.trim().split(/\r?\n/).pop();

test('IO-09 a synthetic legacy backup and seed plan composed by the migration script import into a new account with every record, review, progress and strength entry in place, and the import can be undone (D-08)', async ({
  app,
  page,
}, testInfo) => {
  const dir = testInfo.outputPath('migration-demo');
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--demo', dir], { encoding: 'utf8' });
    expect(lastLine(out)).toBe('MIGRATION OK');
    expect(out).not.toContain('SYNTH');
    const legacy = readJsonFile(join(dir, 'synth-legacy-backup.json'));
    const seed = readJsonFile(join(dir, 'synth-plan-seed.json'));
    const migratedText = readFileSync(join(dir, 'synth-migrated.json'), 'utf8');

    // 摘要里的计数：只从合成旧备份和合成种子独立算出
    const dates: string[] = legacy.logs.map((l: any) => l.date).sort();
    const seedGroups: any[] = seed.plan.groups;
    const seedTaskIds: string[] = seedGroups.flatMap((g) => g.tasks.map((t: any) => t.id));
    const customIds: string[] = legacy.custom.map((c: any) => c.id);
    // 进度对得上种子计划（内置任务）或自定义待办的才留下；对不上的（孤儿）由脚本丢弃
    const keptProgress = Object.fromEntries(
      Object.entries<any>(legacy.tasks).filter(([id]) => seedTaskIds.includes(id) || customIds.includes(id)),
    );
    const orphanIds = Object.keys(legacy.tasks).filter((id) => !(id in keptProgress));
    expect(orphanIds).toEqual(['P9-1']);
    const doneCount = Object.values<any>(keptProgress).filter((p) => p.done).length;
    const liftEntries = Object.values<any>(legacy.lifts).reduce((n, l) => n + l.hist.length, 0);
    expect(out).toContain(`记录 ${legacy.logs.length} 条、复盘 ${Object.keys(legacy.reviews).length} 周、完成的任务 ${doneCount} 项、力量记录 ${liftEntries} 条`);
    expect(out).toContain(`计划 ${seedGroups.length} 组、${seedTaskIds.length} 项任务、${seed.plan.lifts.length} 个力量项`);
    expect(out).toContain(`对不上计划的任务进度 ${orphanIds.length} 条`);

    await app.open({ mode: 'cloud', seed: syntheticState('mig'), login: 0 });
    const planBefore = app.fake.lastPlan(0);
    const stateBefore = expectedNormalize(syntheticState('mig'));

    // 合成好的文件作为内存文件导入；孤儿已由脚本丢弃，所以摘要没有醒目行
    await chooseImportFile(page, textImportFile('synth-migrated.json', migratedText));
    const confirm = await readConfirm(page);
    expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
    expect(confirm.lines).toEqual([
      IMPORT_KIND_FULL,
      IMPORT_REPLACE_FULL,
      importLogsLine(legacy.logs.length, dates[0], dates[dates.length - 1]),
      importMoreLine(Object.keys(legacy.reviews).length, doneCount, liftEntries),
      importPlanLine(seedGroups.length, seedTaskIds.length, seed.plan.lifts.length),
      importCurrentLine(1),
      IMPORT_UNDO_NOTE,
    ]);
    expect(confirm.warn).toEqual([]);
    expect(app.fake.lastPlan(0)).toEqual(planBefore);
    await confirmOk(page);
    await expectToast(page, TOAST_IMPORTED);

    // 服务器上的计划：组、任务、力量项的 id 和文字与种子一致
    const shape = (p: any) => ({
      groups: p.groups.map((g: any) => ({ id: g.id, cat: g.cat, name: g.name, tasks: g.tasks.map((t: any) => ({ id: t.id, text: t.text })) })),
      lifts: p.lifts.map((l: any) => ({ id: l.id, n: l.n, unit: l.unit, def: l.def, target: l.target })),
    });
    await expect.poll(() => shape(app.fake.lastPlan(0) ?? { groups: [], lifts: [] }), { message: '等待服务器 plan 变成合成种子计划' }).toEqual(shape(seed.plan));

    // 服务器上的记录：记录 id 相同、旧类别名已迁移，复盘的周相同，任务进度是去掉孤儿后的各项，力量历史相同
    await expect
      .poll(() => app.fake.lastState(0)?.logs?.length, { message: '等待服务器 state 拿到合成记录' })
      .toBe(legacy.logs.length);
    const server = app.fake.lastState(0);
    expect(server.logs.map((l: any) => ({ id: l.id, date: l.date, cat: l.cat }))).toEqual(
      legacy.logs.map((l: any) => ({ id: l.id, date: l.date, cat: expectedCategory(l.cat) })),
    );
    expect(server.logs.map((l: any) => l.text)).toEqual(legacy.logs.map((l: any) => l.text));
    expect(server.reviews).toEqual(legacy.reviews);
    expect(server.tasks).toEqual(keptProgress);
    expect(server.custom).toEqual(legacy.custom);
    expect(server.lifts).toEqual(legacy.lifts);
    expect(server.arrival).toBe(legacy.arrival);

    // 页面：目标页的完成状态、力量卡的历史、时间线都对应到合成数据
    await gotoGoals(page);
    const groups = await readGroups(page);
    expect(groups.map((g) => g.code)).toEqual(expect.arrayContaining(['P1', 'P2']));
    const g1 = groups.find((g) => g.code === 'P1')!;
    const g2 = groups.find((g) => g.code === 'P2')!;
    expect(g1.taskIds).toEqual(['P1-1', 'P1-2']);
    expect(g1.doneIds).toEqual(['P1-1']);
    expect(g2.taskIds).toEqual(expect.arrayContaining(['P2-1', 'P2-2', ...customIds]));
    expect(g2.doneIds).toEqual(customIds.filter((id) => keptProgress[id]?.done));
    expect(g2.dueInputIds).toContain('P2-1');
    const benchHist = liftHistoryText(legacy.lifts.bench.hist);
    expect(benchHist).not.toBeNull();
    expect(await liftHistoryEquals(page, 'bench', benchHist as string)).toBe(true);

    await gotoTimeline(page);
    expect(await readTimeline(page)).toEqual(expectedTimeline(server, FILTER_ALL));

    // 撤销导入：导入后没有新修改，直接撤销；服务器上的计划和记录回到导入前
    await expect(page.locator('#undoImportBtn')).toHaveText(BTN_UNDO_IMPORT);
    await page.locator('#undoImportBtn').click();
    await expectToast(page, TOAST_UNDONE);
    await expect(page.locator('#undoImportBtn')).toBeHidden();
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 回到导入前' }).toEqual(planBefore);
    await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 回到导入前' }).toEqual(stateBefore);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IO-09 the migration script self-test passes and prints only counts', async () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--self-test'], { encoding: 'utf8' });
  expect(out).toContain('自检通过');
  expect(out).not.toContain('SYNTH');
});
