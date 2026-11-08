#!/usr/bin/env bash
# 03-configure-pocketbase.sh —— 批次 A 第 3 步：安装探针迁移、生成合成探针账号和 config.js（Phase 6，06-06，D-13）
#
# 前提：已经上传并核对过 /tmp/usj-probe-upload/server/pb_migrations/ 下的两个文件
#   （probe_schema.js 和 probe_user.js.tpl），并且 02-install-pocketbase.sh 已经跑完。
# 会改什么（需要所有者批准，D-04）：
#   - 建 /var/www/usj 和 /var/www/usj/probe（root:root 0755，install -d；已存在时不变）。06-07 之后的页面脚本往
#     同一目录装页面，所以这里先建好父目录，否则最后写 config.js 那一步会在 set -e 下失败，留下半配置；
#   - 把 probe_schema.js 装成 /var/lib/pocketbase/pb_migrations/<时间戳>_probe_schema.js（pocketbase 所有，0640）；
#   - 在服务器上用 openssl 随机生成合成探针账号（邮箱本地部分 8 位十六进制，口令 32 位十六进制），
#     替换模板里的两个占位，装成 <时间戳+1>_probe_user.js（pocketbase 所有，0600）；
#   - 用同一组值生成 /var/www/usj/probe/config.js（root:root 0644，给 window.PROBE_CONFIG 赋值）。
#     这个账号的口令本来就公开（任何打开探针页的人都能读到 config.js），权限靠迁移里的规则收到最小。
#   - 不启动 PocketBase、不改 nginx、不建超级用户（超级用户由所有者自己在 06-08 输入，D-05）。
# 两个值只存在于这两个文件里：不 echo、不写日志、不放进任何命令行参数（替换用 bash 内置的字符串替换，
#   写文件用 printf 内置命令经管道交给 sudo tee），生成后 unset。没有 set -x。
# 幂等：迁移（schema 和 user）和 config.js 三样都已存在，输出 PB_CONFIGURE=already 并退出 0；
#   只存在其中一部分（半配置）时，stderr 写一行说明并退出 1，不重新生成（重新生成会换一组口令，
#   让已经装好的另一半对不上）。按下面的回滚步骤清理后再重跑。
# 失败策略：set -euo pipefail；上传的文件缺一个就在做任何事之前退出 1。
# 回滚：
#   sudo rm -f /var/lib/pocketbase/pb_migrations/*_probe_schema.js /var/lib/pocketbase/pb_migrations/*_probe_user.js /var/www/usj/probe/config.js

set -euo pipefail

UP=/tmp/usj-probe-upload/server/pb_migrations
MIG_DIR=/var/lib/pocketbase/pb_migrations
WEB_DIR=/var/www/usj/probe
CONFIG_JS="$WEB_DIR/config.js"

for f in "$UP/probe_schema.js" "$UP/probe_user.js.tpl"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少上传的文件 $f，请先按批准清单上传。" >&2
    exit 1
  fi
done

if ! sudo -n test -d "$MIG_DIR" </dev/null; then
  echo "错误：$MIG_DIR 不存在，请先运行 02-install-pocketbase.sh。" >&2
  exit 1
fi

# 在生成任何东西之前先建网页目录
sudo -n install -d -o root -g root -m 0755 /var/www/usj /var/www/usj/probe </dev/null

count_files() {
  # $1 目录 $2 名称模式；目录读不到时当 0 个
  { sudo -n find "$1" -maxdepth 1 -type f -name "$2" </dev/null 2>/dev/null || true; } | wc -l | tr -dc '0-9'
}
N_SCHEMA=$(count_files "$MIG_DIR" '*_probe_schema.js')
N_USER=$(count_files "$MIG_DIR" '*_probe_user.js')
HAVE_CONFIG=0
if [ -f "$CONFIG_JS" ]; then HAVE_CONFIG=1; fi

if [ "$N_SCHEMA" -ge 1 ] && [ "$N_USER" -ge 1 ] && [ "$HAVE_CONFIG" -eq 1 ]; then
  echo "PB_MIGRATIONS=$((N_SCHEMA + N_USER))"
  echo "PROBE_CONFIG_JS=present"
  echo "PB_CONFIGURE=already"
  exit 0
fi
if [ "$N_SCHEMA" -ge 1 ] || [ "$N_USER" -ge 1 ] || [ "$HAVE_CONFIG" -eq 1 ]; then
  echo "错误：发现半配置（schema 迁移 $N_SCHEMA 个、探针账号迁移 $N_USER 个、config.js $HAVE_CONFIG 个），不重新生成。按文件头的回滚步骤清理后再重跑。" >&2
  exit 1
fi

# ---------- 迁移：集合和设置 ----------
TS="$(date +%s)"
sudo -n install -o pocketbase -g pocketbase -m 0640 "$UP/probe_schema.js" "$MIG_DIR/${TS}_probe_schema.js" </dev/null

# ---------- 合成探针账号：只在服务器上生成，不打印 ----------
umask 077
P_ID="$(openssl rand -hex 4)"
P_VAL="$(openssl rand -hex 16)"
P_MAIL="probe-${P_ID}@example.com"
if [ "${#P_ID}" -ne 8 ] || [ "${#P_VAL}" -ne 32 ]; then
  echo "错误：openssl 没有生成预期长度的随机值。" >&2
  exit 1
fi

TPL="$(cat "$UP/probe_user.js.tpl")"
USER_JS="${TPL//__PROBE_EMAIL__/$P_MAIL}"
USER_JS="${USER_JS//__PROBE_PASSWORD__/$P_VAL}"
USER_DEST="$MIG_DIR/$((TS + 1))_probe_user.js"
sudo -n install -o pocketbase -g pocketbase -m 0600 /dev/null "$USER_DEST" </dev/null
printf '%s\n' "$USER_JS" | sudo -n tee "$USER_DEST" >/dev/null

# config.js 最后写；没有 config.js 时才生成（上面已经保证三样都不存在）
sudo -n install -o root -g root -m 0644 /dev/null "$CONFIG_JS" </dev/null
printf 'window.PROBE_CONFIG = { email: "%s", password: "%s" };\n' "$P_MAIL" "$P_VAL" | sudo -n tee "$CONFIG_JS" >/dev/null

unset P_ID P_VAL P_MAIL TPL USER_JS

echo "PB_MIGRATIONS=2"
echo "PROBE_CONFIG_JS=present"
echo "PB_CONFIGURE=done"
