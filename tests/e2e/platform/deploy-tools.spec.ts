// OPS-03：部署工具的自检和上传包的离线核对。不开浏览器，不联网，不读 private/，在默认套件里运行。
// 线上阶段（verify-site 的 --stage baseline|full）只在批准的步骤里对真实站点运行，这里不碰。
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect } from '../../support/test';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const script = (name: string) => path.join(repoRoot, 'deploy', name);
const lastLine = (out: string) => out.trim().split(/\r?\n/).pop() ?? '';
const run = (args: string[]) => execFileSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('OPS-03 the deploy tools pass their self-tests (build-site, server-check, server-config-check, verify-site)', () => {
  for (const name of ['build-site.mjs', 'server-check.mjs', 'server-config-check.mjs', 'verify-site.mjs']) {
    expect(lastLine(run([script(name), '--self-test'])), name).toMatch(/^SELF-TEST OK \(\d+ cases\)$/);
  }
});

test('OPS-03 a fresh build is a complete upload bundle whose CSP matches its page and whose server files match the repository', ({}, testInfo) => {
  const bundle = testInfo.outputPath('bundle');
  expect(lastLine(run([script('build-site.mjs'), '--out', bundle]))).toMatch(/^BUILD OK [0-9a-f]{12} \(33 files\)$/);
  expect(lastLine(run([script('verify-site.mjs'), '--check-bundle', bundle]))).toBe('BUNDLE OK (9 checks)');
});
