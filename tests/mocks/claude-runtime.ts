// 页面侧的 window.claude mock，对齐 Claude Artifact 运行时契约 0.2.96
// （依据 Claude Code 自带的 artifact-capabilities 技能里的 claude.d.ts、db.d.ts、user.d.ts、downloads.d.ts）。
//
// 约束：
//  - 只做正常路径（D-02）：不写拒绝逻辑、错误码、限流或延迟，也不用定时器让 use() 晚一点完成
//    （定时器会被 manual 时钟卡住）。错误路径属于 v2 的 ERR-01 到 ERR-04。
//  - installClaudeMock 必须自包含（D-04）：addInitScript 会把函数序列化成源码发给浏览器，
//    所以所有辅助函数都定义在函数体内，不引用模块里的任何变量，这个文件也没有 import 语句。
//  - binding 只在 get、set、save 被调用时才去取（D-01）：init 阶段不碰它。
//  - 状态都在 Node 侧的 MockBackend 里，页面里只有往返调用，所以 reload 后数据仍在。

export interface MockConfig {
  // exposeBinding 注册的 binding 名
  binding: string;
  // user.id() 的返回值；null 表示没有身份，应用会退回本地模式（D-07 的反向对照用）
  userId: string | null;
}

export function installClaudeMock(cfg: MockConfig): void {
  const w = window as any;

  // 调用时才读 binding，传 JSON 字符串，返回值也是 JSON 字符串
  const rpc = async (op: string, arg: unknown): Promise<any> => {
    const raw = await w[cfg.binding](op, JSON.stringify(arg));
    return JSON.parse(raw);
  };

  // 递归冻结：契约规定交付的快照和 data() 都是冻结的
  const deepFreeze = (value: any): any => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  };

  // 路径文法（契约 PATH GRAMMAR）：偶数段、至少 2 段、不超过 16 段；
  // 每段只含字母、数字和 _ - . ~ : @ +，不是单独的 . 或 ..，最长 200；整条路径最长 1000。
  // 违反时同步抛 TypeError，消息写明是哪一条规则。
  const checkPath = (path: unknown): string[] => {
    if (typeof path !== 'string') throw new TypeError('doc path must be a string');
    if (path.length > 1000) throw new TypeError('doc path is longer than 1000 characters');
    const segments = path.split('/');
    if (segments.length < 2) throw new TypeError('doc path needs at least 2 segments, got ' + segments.length);
    if (segments.length % 2 !== 0) {
      throw new TypeError('doc path needs an even number of segments, got ' + segments.length);
    }
    if (segments.length > 16) throw new TypeError('doc path has more than 16 segments, got ' + segments.length);
    for (const segment of segments) {
      if (segment.length > 200) throw new TypeError('doc path segment is longer than 200 characters');
      if (segment === '.' || segment === '..') throw new TypeError('doc path segment must not be . or ..');
      if (!/^[A-Za-z0-9_.~:@+-]+$/.test(segment)) {
        throw new TypeError('doc path segment has characters outside letters, digits and _ - . ~ : @ +');
      }
    }
    return segments;
  };

  const db = Object.freeze({
    doc(path: string) {
      const segments = checkPath(path);
      const id = segments[segments.length - 1];
      return Object.freeze({
        id,
        path,
        async get() {
          const reply = await rpc('db.get', { path });
          const exists = reply.exists === true;
          const data = exists ? deepFreeze(reply.data) : undefined;
          return Object.freeze({
            id,
            exists,
            data: () => data,
            metadata: Object.freeze({ fromCache: false, hasPendingWrites: false }),
          });
        },
        async set(data: Record<string, unknown>) {
          await rpc('db.set', { path, data });
          return undefined;
        },
      });
    },
  });

  const user = Object.freeze({
    async id() {
      return cfg.userId;
    },
  });

  const downloads = Object.freeze({
    // data 按契约可以是字符串、Blob、ArrayBuffer 或 ArrayBufferView；统一转成文本交给 Node 侧记录
    async save(request: { filename: string; data: string | Blob | ArrayBuffer | ArrayBufferView }) {
      const data = request.data;
      let text: string;
      if (typeof data === 'string') {
        text = data;
      } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
        text = await data.text();
      } else {
        text = new TextDecoder().decode(data as ArrayBuffer | ArrayBufferView);
      }
      await rpc('downloads.save', { filename: request.filename, data: text });
      return Object.freeze({ status: 'saved' as const });
    },
  });

  // 命名空间表和 Promise 缓存：用 Map.has 判断，所以 toString、constructor 这类继承来的名字也返回 null
  const namespaces = new Map<string, unknown>([
    ['db', db],
    ['user', user],
    ['downloads', downloads],
  ]);
  const promises = new Map<string, Promise<unknown>>();

  const use = (name: string): Promise<unknown> => {
    if (!namespaces.has(name)) return Promise.resolve(null);
    if (!promises.has(name)) promises.set(name, Promise.resolve(namespaces.get(name)));
    return promises.get(name) as Promise<unknown>;
  };

  Object.defineProperty(window, 'claude', {
    value: Object.freeze({ use }),
    configurable: false,
    writable: false,
    enumerable: true,
  });
}
