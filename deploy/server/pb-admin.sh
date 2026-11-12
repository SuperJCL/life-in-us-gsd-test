#!/usr/bin/env bash
# pb-admin.sh —— 带钥匙和固定目录运行 PocketBase 命令行（Phase 13，13-06，D-02、D-11）
#
# 前提：以 pocketbase 用户运行（sudo -u pocketbase /usr/local/sbin/pb-admin.sh <PocketBase 子命令>）；
#   /etc/usj/pocketbase.env 里有 32 个字符的加密钥匙（03-configure-pocketbase.sh 生成，root:pocketbase 0640）。
#   装到服务器上的路径是 /usr/local/sbin/pb-admin.sh（root 0755），由 03-configure-pocketbase.sh 安装。
# 会改什么：脚本本身什么都不改；它运行的 PocketBase 子命令会改库（例如建超级用户）。
#   用和服务 unit 相同的 --dir、--migrationsDir、--hooksDir、--automigrate=false、--encryptionEnv，
#   这样命令行和服务看到的是同一份库、同一把钥匙：设置一旦存成密文，漏带钥匙的命令会直接退出。
#   钥匙只作为环境变量传给 PocketBase 进程，不进命令行参数，也不打印。
# 两个用法（邮箱和口令由所有者在网页终端自己输入，不写进任何文件）：
#   1. 建超级用户或改口令：先 read -r EM 和 read -rs PW 读入邮箱和口令，再
#        sudo -u pocketbase /usr/local/sbin/pb-admin.sh superuser upsert "$EM" "$PW"
#   2. 两步验证（OTP）把自己锁死时：sudo -u pocketbase /usr/local/sbin/pb-admin.sh superuser otp "$EM"
#      （按 PocketBase 的提示取一次性口令登录后台，再去后台修好设置）
#   如实说明（IN-06）：口令作为参数传给 superuser upsert，在命令执行的那一瞬间会出现在进程参数里，
#   同一台机器上的其他用户用 ps 在这一瞬间能看到；服务器上只有所有者的账号能登录，这个风险接受，不要在多人共用的机器上这样用。
# 输出：只有 PocketBase 子命令自己的输出；本脚本自己的错误写 stderr。不打印钥匙。
# 失败策略：set -euo pipefail；不是 pocketbase 用户退出 2；环境文件读不到或钥匙长度不是 32 退出 2；都不打印值。
# 回滚：不需要（装在 /usr/local/sbin 的单个文件，删掉即可）。

set -euo pipefail

ENV_FILE=/etc/usj/pocketbase.env

if [ "$(id -un)" != "pocketbase" ]; then
  echo "错误：请用 sudo -u pocketbase 运行本脚本。" >&2
  exit 2
fi
if [ ! -r "$ENV_FILE" ]; then
  echo "错误：读不到环境文件，请先运行 03-configure-pocketbase.sh。" >&2
  exit 2
fi

KEY=""
while IFS='=' read -r k v || [ -n "${k:-}" ]; do
  if [ "$k" = "PB_ENCRYPTION_KEY" ]; then
    KEY="$v"
  fi
done < "$ENV_FILE"

if [ "${#KEY}" -ne 32 ]; then
  echo "错误：环境文件里的加密钥匙缺失或长度不是 32。" >&2
  exit 2
fi
export PB_ENCRYPTION_KEY="$KEY"
unset KEY

cd /var/lib/pocketbase
exec /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data --migrationsDir=/var/lib/pocketbase/pb_migrations --hooksDir=/var/lib/pocketbase/pb_hooks --automigrate=false --encryptionEnv=PB_ENCRYPTION_KEY "$@"
