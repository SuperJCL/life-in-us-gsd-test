# PB-LOCAL：本机一次性 PocketBase 的程序说明

本机测试用的 PocketBase 只在一次性实例里运行：程序留存在被 git 忽略的 `tools/pb/bin/`，每次运行前核对 sha256，实例和数据放在系统临时目录、用完删除。程序文件不进仓库。

| 项目 | 内容 |
|------|------|
| 版本 | 0.41.1（与服务器一致） |
| 来源 | `https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/pocketbase_0.41.1_windows_amd64.zip`（维护者自己的发布站；会 307 跳转到同站的文件接口，脚本手动跟随，最多 5 次，每次都要求 https） |
| 文件名 | `pocketbase_0.41.1_windows_amd64.zip` |
| 大小 | 13,012,018 字节 |
| zip 的 sha256 | `fda68dcbb4812585cf32282a8e79c09f0b065c109c75d840f46d8fd8b59b0580`（来自同站 checksums.txt 里该文件那一行） |
| exe 的 sha256 和字节数 | 下载并核对后由 08-04 Task 3 写入；写入前 `tools/pb/lib/instance.mjs` 拒绝运行 |
| 所有者批准 | 下载并核对后由 08-04 Task 3 写入日期和原话；写入前不下载 |

## 信任模型（单一来源）

- GitHub 上没有 v0.41.1 的发布（GitHub 最新是 v0.40.6），0.41.0 起官方发布只在维护者自己的站点。所以 Windows 包的指纹只有 checksums.txt 这一个来源，属于单一来源。
- checksums.txt 与 zip 在同一个站点、没有签名，核对只能防下载损坏，防不了发布站本身被入侵。
- Phase 8 D-03 里“GitHub 发布页有指纹就交叉核对”对 0.41.1 不适用。
- 弱补强：下载时同时核对 checksums.txt 里 linux_amd64 那一行仍等于 Phase 6 在服务器安装脚本里钉死的值。
- 这与 Phase 6 的 D-16 是同一个信任模型；所有者在批准下载时已被如实告知。

## 下载与核对（只能在所有者批准之后）

`node tools/pb/fetch-local-pb.mjs --approved`：

1. zip 和 checksums.txt 各放进新建的空临时目录；
2. 三项核对：zip 的大小和 sha256 等于钉死值；checksums.txt 里该 zip 恰好一行且等于钉死值；linux 那一行仍等于 Phase 6 钉死的值。三项都对才解压；
3. 只解出 `pocketbase.exe` 一个文件到 `tools/pb/bin/`；
4. 打印 exe 的 sha256 和字节数，记进本文件和 `instance.mjs` 的 `PB_EXE_SHA256`；
5. 再次运行时，exe 已在且哈希对得上就报告 `PB ALREADY PRESENT`，不再联网。

`node tools/pb/fetch-local-pb.mjs --self-test` 不联网，只检查核对函数。

## 运行

- 每次启动实例前，`instance.mjs` 核对 exe 的 sha256；缺失、未钉死或不一致都以退出码 2 停下，不运行。
- 实例只监听 127.0.0.1 的随机端口，数据目录在系统临时目录（`usj-pb-` 前缀），关闭自动迁移，以低于正常的优先级运行，同一时间只有一个实例。
- 超级用户和合成账号每次运行时随机生成，不写文件、不打印；创建超级用户用的是程序自带的子命令，只以参数数组传入。
- 子进程的输出只写进临时目录里的日志文件，随目录一起删除。
- Windows 首次运行如果弹出防火墙提示，选“取消”（实例只在本机回环地址上，不需要放行）。
- 脚本被强行结束时进程可能残留：在任务管理器里结束 `pocketbase.exe`，再删除系统临时目录里 `usj-pb-` 开头的目录。

验证命令：`node tools/pb/lib/instance.mjs --self-test`（不需要程序）和 `node tools/pb/lib/instance.mjs --smoke`（需要程序，真实实例上检查迁移、快照、限流、只监听回环和清理）。

## 更新

换版本必须重新走所有者批准：重新核对来源和指纹、重新批准，再更新本文件和 `instance.mjs` 里的钉死值。下载脚本不会自动重新下载，也不会覆盖已有的程序。
