// Node 侧的 mock 后端：文档、读取记录、写入记录和下载记录都放在这里（D-01）。
// 状态在 Node 进程里，页面刷新后仍在；每个 AppHarness 新建一个实例，用例之间不共享。
// 只做正常路径（D-02）：未知 op 是测试代码的编程错误，直接抛错让用例立即失败。
import { ACCOUNT_DOC_PATH } from '../support/constants';

export class MockBackend {
  // 每次 db.get 的路径，按到达顺序
  reads: string[] = [];
  // 每次 db.set 的路径和内容（深拷贝），按到达顺序
  writes: Array<{ path: string; data: any }> = [];
  // 每次 downloads.save 的文件名和文本内容，按到达顺序
  downloads: Array<{ filename: string; data: string }> = [];

  private docs = new Map<string, unknown>();

  // 把种子存到账户文档路径上（深拷贝，之后改种子对象不影响这里）
  seed(state: unknown): void {
    this.docs.set(ACCOUNT_DOC_PATH, JSON.parse(JSON.stringify(state)));
  }

  // 账户文档的当前内容（深拷贝）；还没有文档时返回 null
  lastState(): any {
    if (!this.docs.has(ACCOUNT_DOC_PATH)) return null;
    return JSON.parse(JSON.stringify(this.docs.get(ACCOUNT_DOC_PATH)));
  }

  // exposeBinding 的处理函数：入参和返回值都是 JSON 字符串
  handle(op: string, json: string): string {
    const arg = JSON.parse(json);
    switch (op) {
      case 'db.get': {
        this.reads.push(arg.path);
        const exists = this.docs.has(arg.path);
        return JSON.stringify({ exists, data: exists ? this.docs.get(arg.path) : undefined });
      }
      case 'db.set': {
        const data = JSON.parse(JSON.stringify(arg.data));
        this.writes.push({ path: arg.path, data: JSON.parse(JSON.stringify(data)) });
        this.docs.set(arg.path, data);
        return 'null';
      }
      case 'downloads.save':
        this.downloads.push({ filename: arg.filename, data: arg.data });
        return 'null';
      default:
        throw new Error('MockBackend: unknown op ' + op);
    }
  }
}
