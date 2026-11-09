// 假 PocketBase 的契约自测（TEST-02，ROADMAP Phase 8 SC3）：证明 Node 侧 FakePbServer 对同一组请求的回应与真实 0.41.1 的样本一致。
//
// 场景表、占位符解析（resolveStep）和归一化都来自录制脚本共用的同一份代码
// （tools/pb/lib/scenarios.cjs、tools/pb/lib/normalize.cjs），所以“同一组请求”是字面意义上的同一组。
// 比对在 Node 侧做，直接调用 FakePbServer.handle()，不开浏览器。
//
// 规则：
//  - 状态码逐步相等，永远不进偏差登记：假服务器不能比真实实例更宽松；
//  - 顶层键集合、归一化后的正文、令牌声明（键、type、四舍五入到整小时的有效期）都要相等；
//  - 只有表示层的差异才能登记进 INTENTIONAL_DEVIATIONS（场景 id、字段路径、原因），并同步写进 PB-CONTRACT.md 第 5 节；
//  - 样本不手改：不一致时改 tests/mocks/pb-server.ts，样本只能由 tools/pb/record-samples.mjs 从真实实例重录。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test, expect } from '../support/test';
import { FakePbServer, type PbDelivery, type PbRequest } from '../mocks/pb-server';
import { FROZEN_NOW, PB_SDK_SHA256, PB_SDK_VERSION, PB_SERVER_VERSION } from '../support/constants';

// 与录制脚本共用的 CommonJS 模块（不依赖动态 import .mjs）
const nodeRequire = createRequire(__filename);
const sc = nodeRequire('../../tools/pb/lib/scenarios.cjs');
const norm = nodeRequire('../../tools/pb/lib/normalize.cjs');

const SAMPLES_DIR = path.join(__dirname, '..', 'mocks', 'pb-samples');
const restSamples = JSON.parse(readFileSync(path.join(SAMPLES_DIR, 'rest.json'), 'utf8'));
const realtimeSamples = JSON.parse(readFileSync(path.join(SAMPLES_DIR, 'realtime.json'), 'utf8'));

// 有意偏差：只能是表示层的差异。path 是 `<步骤序号从 0 起>.<交换里的点路径>`，数组下标用数字，
// 例如 `0.response.body.items.0.writer`。状态码（response.status）不能登记。
const INTENTIONAL_DEVIATIONS: Array<{ scenario: string; path: string; reason: string }> = [];

// 直接取自场景表，不手抄：场景表加一个场景，这里就多一条用例（样本不齐时 sampleFor 会让用例失败）
const CONTRACT_IDS: string[] = [...sc.REST_SCENARIOS, ...sc.REALTIME_SCENARIOS].map((s: { id: string }) => s.id);

const NOW_SECONDS = Math.floor(FROZEN_NOW / 1000);

type RecordedStep = {
  as: string;
  op?: string;
  request?: any;
  response?: any;
  tokenClaims?: any;
  event?: any;
};

function allScenarios(): any[] {
  return [...sc.REST_SCENARIOS, ...sc.REALTIME_SCENARIOS];
}

function sampleFor(id: string): any {
  const found = [...restSamples.scenarios, ...realtimeSamples.scenarios].find((s: any) => s.id === id);
  if (!found) throw new Error(`样本里没有场景 ${id}`);
  return found;
}

// 在全新的 FakePbServer 上，用与录制相同的 resolveStep 和归一化上下文执行一个场景，返回与样本同形的步骤记录
function runFakeScenario(scenario: any): RecordedStep[] {
  const fake = new FakePbServer();
  const ctx: any = { users: {}, docs: {} };
  const names: string[] = scenario.setup.users;
  names.forEach((name, index) => {
    const user = fake.addUser();
    ctx.users[name] = { id: user.id, email: user.email, password: user.password, token: fake.login(index) };
  });
  // 前置文档：与录制脚本一样 writer 是 setup；经 handle() 创建，所有者用自己的令牌
  for (const doc of scenario.setup.docs ?? []) {
    const owner = ctx.users[doc.owner];
    const created = fake.handle({
      method: 'POST',
      path: sc.DOCS,
      query: {},
      authorization: owner.token,
      body: { owner: owner.id, kind: doc.kind, data: doc.data ?? { _synthetic: true }, writer: 'setup' },
    });
    if (!created || created.status !== 200) throw new Error(`假服务器没能建前置文档（${scenario.id}）`);
    ctx.docs[`${doc.owner}:${doc.kind}`] = { id: (created.body as { id: string }).id };
  }

  const nctx = norm.createContext();
  const steps: RecordedStep[] = [];
  // 上一个发请求的步骤的推送；expectEvent 取它
  let lastDeliveries: PbDelivery[] = [];
  for (let i = 0; i < scenario.steps.length; i += 1) {
    const step = sc.resolveStep(scenario.steps[i], ctx);
    if (step.op === 'connect') {
      // 与线上格式一致的 PB_CONNECT：id 是 clientId，data 是 clientId 的 JSON；不开页面，所以连接没有页面
      const connection = fake.openConnection(null);
      ctx.clientId = connection.clientId;
      norm.addClientId(nctx, connection.clientId);
      const event = { id: connection.clientId, event: 'PB_CONNECT', data: JSON.stringify({ clientId: connection.clientId }) };
      steps.push({ op: 'connect', as: 'anon', event: norm.normalizeEvent(event, nctx) });
      continue;
    }
    if (step.op === 'expectEvent') {
      // 取上一步 handle 返回的推送：名字、data、id 与样本里的事件比较
      if (lastDeliveries.length !== 1) {
        throw new Error(`场景 ${scenario.id} 第 ${i + 1} 步：假服务器推送了 ${lastDeliveries.length} 条事件，样本是 1 条`);
      }
      const delivery = lastDeliveries[0];
      const event = { id: delivery.lastEventId, event: delivery.name, data: delivery.data };
      steps.push({ op: 'expectEvent', as: step.as, event: norm.normalizeEvent(event, nctx) });
      continue;
    }
    const authorization: string | null = sc.identityToken(step.as, ctx);
    const request: PbRequest = {
      method: step.method,
      path: step.path,
      query: step.query ?? {},
      authorization,
      body: step.body ?? null,
    };
    const res = fake.handle(request);
    // handle 返回 null 表示假服务器没有实现这条路径：直接失败，不当作“没有差异”
    if (res === null) throw new Error(`假服务器没有实现 ${step.method} ${step.path}（场景 ${scenario.id} 第 ${i + 1} 步）`);
    lastDeliveries = res.deliveries;
    // 与录制脚本一样：登记没有对应连接的随机 clientId，再归一化
    norm.addClientId(nctx, ctx.unknownClientId);
    const exchange = norm.normalizeExchange(
      {
        request: { method: step.method, path: step.path, query: step.query, hasAuth: authorization !== null, body: step.body },
        response: { status: res.status, body: res.body },
      },
      nctx,
    );
    const recorded: RecordedStep = { as: step.as, request: exchange.request, response: exchange.response };
    if (step.op) recorded.op = step.op;
    const token = (res.body as { token?: unknown } | null)?.token;
    // 取整只在 normalize.cjs 的 tokenClaims 里做一次（Math.round）；这里不另写取整
    if (typeof token === 'string') recorded.tokenClaims = norm.tokenClaims(token, NOW_SECONDS);
    steps.push(recorded);
  }
  return steps;
}

// 按点路径删掉一个字段（数字段当数组下标）；路径不存在时什么也不做
function dropPath(target: any, dotted: string): void {
  const segments = dotted.split('.');
  let cursor = target;
  for (let k = 0; k < segments.length - 1; k += 1) {
    cursor = cursor?.[segments[k]];
    if (cursor === null || cursor === undefined) return;
  }
  delete cursor[segments[segments.length - 1]];
}

// 只跳过登记过的字段路径；返回深拷贝
function withoutDeviations(scenarioId: string, stepIndex: number, value: unknown): any {
  const copy = JSON.parse(JSON.stringify(value ?? null));
  for (const d of INTENTIONAL_DEVIATIONS) {
    if (d.scenario !== scenarioId) continue;
    const [head, ...rest] = d.path.split('.');
    if (Number(head) === stepIndex) dropPath(copy, rest.join('.'));
  }
  return copy;
}

function compareScenario(id: string, actual: RecordedStep[], sample: any): void {
  expect(actual.length, `${id} 的步骤数`).toBe(sample.steps.length);
  sample.steps.forEach((expected: any, i: number) => {
    const label = `${id} 第 ${i + 1} 步`;
    const got = actual[i];
    expect(got.as, `${label} 的身份`).toBe(expected.as);
    expect(got.op, `${label} 的步骤类型`).toBe(expected.op);
    if (expected.op === 'connect' || expected.op === 'expectEvent') {
      // 实时事件：名字、data、id（以及 data 的顶层键）
      expect(got.event.event, `${label} 的事件名`).toBe(expected.event.event);
      expect(got.event.id, `${label} 的事件 id`).toBe(expected.event.id);
      expect(got.event.dataKeys, `${label} 的事件 data 顶层键`).toEqual(expected.event.dataKeys);
      expect(withoutDeviations(id, i, got.event.data), `${label} 的事件 data`).toEqual(withoutDeviations(id, i, expected.event.data));
      return;
    }
    // 状态码永远不跳过
    expect(got.response.status, `${label} 的状态码`).toBe(expected.response.status);
    expect(got.response.status, `${label} 的状态码与场景 expect`).toBe(expected.expect);
    expect(got.response.bodyKeys, `${label} 的响应顶层键`).toEqual(expected.response.bodyKeys);
    expect(withoutDeviations(id, i, got.response.body), `${label} 的归一化响应正文`).toEqual(
      withoutDeviations(id, i, expected.response.body),
    );
    // 请求也比：证明 resolveStep 和归一化的编号与录制时一致
    expect(withoutDeviations(id, i, got.request), `${label} 的归一化请求`).toEqual(withoutDeviations(id, i, expected.request));
    // 令牌声明：键、type、四舍五入后的有效期，按相等比较，不加容差
    expect(got.tokenClaims, `${label} 的令牌声明`).toEqual(expected.tokenClaims);
  });
}

for (const id of CONTRACT_IDS) {
  test(`TEST-02 contract ${id} matches the real 0.41.1 sample`, () => {
    const scenario = allScenarios().find((s) => s.id === id);
    expect(scenario, `场景表里没有 ${id}`).toBeTruthy();
    compareScenario(id, runFakeScenario(scenario), sampleFor(id));
  });
}

test('TEST-02 the recorded samples carry no token shapes and pin server 0.41.1 with SDK 0.28.1', () => {
  const sums = readFileSync(path.join(__dirname, '..', '..', 'tools', 'probe', 'page', 'vendor', 'SHA256SUMS'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  expect(sums).toHaveLength(1);
  const sumsHash = sums[0].split(/\s+/)[0];
  expect(sumsHash).toBe(PB_SDK_SHA256);

  const contract = readFileSync(path.join(__dirname, '..', 'mocks', 'PB-CONTRACT.md'), 'utf8');
  expect(contract).toContain(`服务器 ${PB_SERVER_VERSION} 配 SDK ${PB_SDK_VERSION}`);
  expect(contract).toContain(PB_SDK_SHA256);

  for (const file of ['rest.json', 'realtime.json']) {
    const text = readFileSync(path.join(SAMPLES_DIR, file), 'utf8');
    // 令牌的头部是对象 JSON 的 base64，开头固定是这三个字符；样本里一个都不应该有
    expect(text.includes('ey' + 'J'), `${file} 不应含令牌开头的子串`).toBe(false);
    const doc = JSON.parse(text);
    expect(doc._synthetic, `${file} 的 _synthetic`).toBe(true);
    expect(doc.meta.server, `${file} 的 meta.server`).toBe(PB_SERVER_VERSION);
    expect(doc.meta.sdk, `${file} 的 meta.sdk`).toBe(PB_SDK_VERSION);
    expect(doc.meta.sdkSha256, `${file} 的 meta.sdkSha256`).toBe(PB_SDK_SHA256);
    expect(doc.meta.sdkSha256, `${file} 的 meta.sdkSha256 与 SHA256SUMS`).toBe(sumsHash);
  }

  // 偏差登记的健全性：场景存在、有原因、路径不指向状态码（状态码永远不能登记）
  const ids = new Set(CONTRACT_IDS);
  for (const d of INTENTIONAL_DEVIATIONS) {
    expect(ids.has(d.scenario), `偏差登记的场景 ${d.scenario} 不在场景表里`).toBe(true);
    expect(d.reason.trim().length, `偏差 ${d.scenario} ${d.path} 缺少原因`).toBeGreaterThan(0);
    expect(d.path, `偏差 ${d.scenario} 不能登记状态码`).not.toMatch(/(^|\.)status$/);
  }
});
