// 页面侧的假 EventSource，替换真实的 EventSource，让真实 SDK 的实时订阅跑在假服务器上（TEST-02，08-02）。
//
// 约束（同 claude-runtime.ts）：
//  - installFakeEventSource 必须自包含：addInitScript 会把函数序列化成源码发给浏览器，
//    所以所有辅助函数都定义在函数体内，不引用模块里的任何变量，这个文件也没有 import 语句。
//  - 连接状态在 Node 侧的 FakePbServer 里，页面里只登记“连接 id 到实例”，Node 通过 window.__pbEsDeliver 推事件。
//  - 没有定时器：握手靠 binding 的 Promise，事件只在 Node 调用 __pbEsDeliver 时才派发。

export interface FakeEventSourceConfig {
  // context.exposeBinding 注册的 binding 名
  binding: string;
}

export function installFakeEventSource(cfg: FakeEventSourceConfig): void {
  const w = window as any;

  // 调用时才读 binding，传 JSON 字符串，返回值也是 JSON 字符串
  const rpc = async (op: string, arg: unknown): Promise<any> => {
    const raw = await w[cfg.binding](op, JSON.stringify(arg));
    return JSON.parse(raw);
  };

  // 连接 id 到实例；Node 推送时按它找到目标
  const live = new Map<string, any>();

  class FakeEventSource extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readyState = 0;
    url: string;
    withCredentials = false;
    onopen: any = null;
    onmessage: any = null;
    onerror: any = null;
    private connectionId = '';

    constructor(url: string | URL) {
      super();
      this.url = String(url);
      // 必须异步握手：SDK 在 new EventSource 返回之后才挂 PB_CONNECT 监听
      rpc('es.open', { url: this.url }).then((r) => {
        if (this.readyState === 2) {
          // 握手期间已被关闭：通知 Node 注销，不再派发 PB_CONNECT
          rpc('es.close', { connectionId: r.connectionId });
          return;
        }
        this.connectionId = r.connectionId;
        live.set(this.connectionId, this);
        this.readyState = 1;
        this.fire('PB_CONNECT', JSON.stringify({ clientId: r.clientId }), r.clientId);
      });
    }

    // 派发事件，并手动调用 on<name> 属性处理函数（EventTarget 不会自动调用它们）
    fire(name: string, data: string, lastEventId: string) {
      const ev = new MessageEvent(name, { data, lastEventId });
      this.dispatchEvent(ev);
      const handler = (this as any)['on' + name];
      if (typeof handler === 'function') handler.call(this, ev);
    }

    close() {
      this.readyState = 2;
      if (this.connectionId) {
        live.delete(this.connectionId);
        rpc('es.close', { connectionId: this.connectionId });
        this.connectionId = '';
      }
    }
  }

  w.EventSource = FakeEventSource;

  // Node 侧推送：找得到连接就派发并返回 true，找不到返回 false（Node 记进 deliveryErrors）
  w.__pbEsDeliver = (connectionId: string, name: string, data: string, lastEventId: string): boolean => {
    const target = live.get(connectionId);
    if (!target) return false;
    target.fire(name, data, lastEventId);
    return true;
  };
}
