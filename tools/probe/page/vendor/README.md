# vendor：探针页用的 PocketBase JS SDK

探针页（`../index.html`）只加载同源文件，所以 SDK 不走 CDN，而是把官方打包好的单个静态文件放在这里，与页面一起托管。

| 项目 | 内容 |
|------|------|
| 包名和版本 | npm 包 `pocketbase` 0.28.1 |
| 取用的文件 | 只取 `package/dist/pocketbase.iife.js` 和 `package/LICENSE.md` |
| 为什么是 0.28.1，不是 0.28.2 | D-15：0.28.2 太新，且 npm 元数据里没有仓库地址，包检查工具把它标为可疑；0.28.1 是它之前的上一个稳定版，0.28.x 面向 PocketBase 0.40 及以上，探针用到的登录、创建记录、实时订阅接口都在其中 |
| 来源 | `https://registry.npmjs.org/pocketbase/-/pocketbase-0.28.1.tgz`（仓库 github.com/pocketbase/js-sdk） |
| registry 的 integrity | `sha512-/3ihkq+rvfcs0MQgrK4sEElOg6gfenHW9S/O+3BSO+V1yT+4B10+9aT22uTQUPqze9ItwNtwWyY5ZmdgVCTdVA==` |
| registry 的 shasum（sha1） | `742f4d1add0b628ddcef109895c2cdbb81167736` |
| 本次核对结果 | 下载的 tarball（369510 字节）用 node crypto 算出的 sha512 和 sha1 与上面两个值逐字一致，一致之后才解压；解压在新建的空目录里，只解出上述两个文件，没有运行包里的任何东西，没有 `npm install` |
| `pocketbase.iife.js` 的 sha256 | `94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f` |
| `pocketbase.iife.js` 的字节数 | 40539 |
| 许可证 | MIT（`LICENSE.md`，Gani Georgiev） |
| 所有者批准 | 2026-11-08，在 06-05 的包合法性检查点（Task 2，`blocking-human`）回复“批准下载 0.28.1”；该批准只覆盖这一次下载 |

校验：`cd tools/probe/page/vendor && sha256sum -c SHA256SUMS`。文件按原字节保存，`.gitattributes` 里 `tools/probe/page/vendor/** -text` 保证换行不被改写，哈希才稳定。

## 更新办法

换版本必须重新走一遍：先由所有者在包合法性检查点核对来源、维护者和完整性值并批准，再下载、比对 sha512 和 sha1、只解出这两个文件，最后更新 `SHA256SUMS` 和本文件。服务器上的安装脚本和 `verify-site.mjs` 会再核对服务器上这个文件的哈希。
