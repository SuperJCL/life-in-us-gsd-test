#!/usr/bin/env bash
# 03-configure-pocketbase.sh —— 生成环境文件（加密钥匙和站点地址），安装迁移、钩子和两个工具（Phase 13，13-06，D-02、D-11、IN-09）
#
# 用法：03-configure-pocketbase.sh /tmp/usj-deploy.<随机>
#   第一个参数是上传目录（mktemp -d 建的 0700 目录，属于当前用户，里面有 SHA256SUMS）。
# 前提：02-install-pocketbase.sh 已跑完（/var/lib/pocketbase/pb_migrations 存在）；已上传的文件在 SHA256SUMS 里各有一行；
#   服务器上有 certbot 管理的 nginx 站点文件（站点地址从那里读，不从仓库或命令行传入）。
#   会改什么的时候 PocketBase 服务必须没在运行（13-10 先跑 07-retire-probe.sh，那时已经停了）；
#   什么都不用改（重跑）时服务在不在运行都可以。
# 入口检查（任何改动之前）：上传目录格式、属主、权限；要读的每个文件在 SHA256SUMS 里恰好一行并通过 sha256sum -c；
#   同名的迁移或钩子已经存在但内容不同就退出 1（已经应用过的迁移不能被覆盖）；站点地址取不到就退出 1；
#   环境文件已存在时只核对，不符就退出 1，从不覆盖钥匙。
# 会改什么（需要所有者批准）：
#   - 建 /etc/usj（root:pocketbase 0750）和 /var/lib/pocketbase/pb_hooks（pocketbase 0750）；
#   - 环境文件 /etc/usj/pocketbase.env 不存在时：在服务器上用 openssl rand -hex 16 生成 32 个十六进制字符的加密钥匙，
#     连同站点地址写进去（root:pocketbase 0640）。钥匙只在这个脚本的变量里，经管道交给 tee，从不打印、不进命令行参数，写完就 unset；
#   - 站点地址 USJ_ORIGIN=https://<裸域名>：从 certbot 管理的那一行 server_name … # managed by Certbot 里取出不带 www. 的那个名字；
#   - 把应用迁移 4 个文件装进 /var/lib/pocketbase/pb_migrations（pocketbase 0640，同名同内容跳过）；
#   - 把 backup-watch.pb.js 装进 /var/lib/pocketbase/pb_hooks（pocketbase 0640，同名同内容跳过）；
#   - 装 /usr/local/sbin/pb-admin.sh 和 /usr/local/sbin/usj-restore-drill（root 0755，同内容跳过，内容不同就更新）。
#   不启动或停止任何服务、不碰 nginx、不碰二进制。
# 钥匙怎么保管：所有者在阿里云网页终端自己运行 sudo cat /etc/usj/pocketbase.env，把钥匙存进自己的密码管理器（13-11）。
#   钥匙丢了，设置（SMTP、R2 凭据）就读不出来，PocketBase 起不来；这个脚本和 Claude 都不经手明文。
# 输出：KEY=VALUE。PB_ENV_FILE=created|kept、PB_KEY_LEN_OK=yes、PB_ORIGIN_SET=yes、PB_MIGRATIONS_APP=4、PB_HOOKS=1、
#   PB_ADMIN_TOOL=installed|same、DRILL_TOOL=installed|same、PB_CONFIGURE=done|already。
# 失败策略：set -euo pipefail；没有 set -x；不回显任何钥匙；可能读标准输入的命令都带 </dev/null；改动之前先做完所有检查。
# 回滚：
#   sudo rm -f /var/lib/pocketbase/pb_hooks/backup-watch.pb.js /usr/local/sbin/pb-admin.sh /usr/local/sbin/usj-restore-drill
#   迁移文件已经被 PocketBase 应用过就不要删；环境文件和钥匙留在 /etc/usj（删掉钥匙会让已加密的设置无法读取）。

set -euo pipefail

# ---------- 入口：上传目录（IN-09） ----------
UP="${1:-}"
if [ -z "$UP" ]; then
  echo "错误：第一个参数必须是上传目录 /tmp/usj-deploy.<随机>。" >&2
  exit 2
fi
if ! [[ "$UP" =~ ^/tmp/usj-deploy\.[A-Za-z0-9]+$ ]]; then
  echo "错误：上传目录的格式不对（必须是 /tmp/usj-deploy.<随机>）。" >&2
  exit 2
fi
if [ -L "$UP" ] || [ ! -d "$UP" ]; then
  echo "错误：上传目录不存在或是符号链接。" >&2
  exit 1
fi
if [ "$(stat -c %u "$UP")" != "$(id -u)" ] || [ "$(stat -c %a "$UP")" != "700" ]; then
  echo "错误：上传目录必须属于当前用户且权限是 700。" >&2
  exit 1
fi
if [ ! -f "$UP/SHA256SUMS" ]; then
  echo "错误：上传目录里没有 SHA256SUMS。" >&2
  exit 1
fi

verify_uploads() {
  # 每个文件在 SHA256SUMS 里恰好一行（两个空格和 " *" 两种分隔都接受），并在 $UP 里 sha256sum -c 通过
  local rel n lines
  for rel in "$@"; do
    n="$(awk -v p="$rel" '{ f = $2; sub(/^\*/, "", f); if (f == p) c++ } END { print c + 0 }' "$UP/SHA256SUMS")"
    if [ "$n" != "1" ]; then
      echo "错误：SHA256SUMS 里 $rel 的行数不是 1（是 $n）。" >&2
      exit 1
    fi
    lines="$(awk -v p="$rel" '{ f = $2; sub(/^\*/, "", f); if (f == p) print $1 "  " f }' "$UP/SHA256SUMS")"
    if ! printf '%s\n' "$lines" | (cd "$UP" && sha256sum -c --strict --status); then
      echo "错误：上传的 $rel 与 SHA256SUMS 不一致，什么都没有改。" >&2
      exit 1
    fi
    if [ -L "$UP/$rel" ] || [ ! -f "$UP/$rel" ]; then
      echo "错误：上传的 $rel 不是普通文件。" >&2
      exit 1
    fi
  done
}

MIGRATIONS="1794096000_users_lockdown.js 1794096100_journey_docs.js 1794096150_retire_probe.js 1794096200_server_settings.js"
HOOK=backup-watch.pb.js
FILES=""
for m in $MIGRATIONS; do FILES="$FILES pb_migrations/$m"; done
FILES="$FILES pb_hooks/$HOOK server/pb-admin.sh server/restore-drill.sh"
# shellcheck disable=SC2086
verify_uploads $FILES

# ---------- 前置检查（只读） ----------
MIG_DIR=/var/lib/pocketbase/pb_migrations
HOOK_DIR=/var/lib/pocketbase/pb_hooks
ENV_DIR=/etc/usj
ENV_FILE=/etc/usj/pocketbase.env
ADMIN_DST=/usr/local/sbin/pb-admin.sh
DRILL_DST=/usr/local/sbin/usj-restore-drill

if ! sudo -n test -d "$MIG_DIR" </dev/null; then
  echo "错误：$MIG_DIR 不存在，请先运行 02-install-pocketbase.sh。" >&2
  exit 1
fi

file_state() {
  # $1 上传的文件 $2 目标：new（目标不存在）、same、differ
  if ! sudo -n test -f "$2" </dev/null; then
    echo new
  elif sudo -n cmp -s "$1" "$2" </dev/null; then
    echo same
  else
    echo differ
  fi
}

NEED_CHANGE=no
for m in $MIGRATIONS; do
  case "$(file_state "$UP/pb_migrations/$m" "$MIG_DIR/$m")" in
    new) NEED_CHANGE=yes ;;
    same) ;;
    *)
      echo "错误：服务器上已有同名迁移 $m 但内容不同，不覆盖已经应用过的迁移，什么都没有改。" >&2
      exit 1
      ;;
  esac
done
case "$(file_state "$UP/pb_hooks/$HOOK" "$HOOK_DIR/$HOOK")" in
  new) NEED_CHANGE=yes ;;
  same) ;;
  *)
    echo "错误：服务器上已有同名钩子 $HOOK 但内容不同，什么都没有改。" >&2
    exit 1
    ;;
esac
ADMIN_STATE="$(file_state "$UP/server/pb-admin.sh" "$ADMIN_DST")"
DRILL_STATE="$(file_state "$UP/server/restore-drill.sh" "$DRILL_DST")"
if [ "$ADMIN_STATE" != same ] || [ "$DRILL_STATE" != same ]; then NEED_CHANGE=yes; fi
if ! sudo -n test -d "$ENV_DIR" </dev/null || ! sudo -n test -d "$HOOK_DIR" </dev/null; then NEED_CHANGE=yes; fi

# 站点地址：从 certbot 管理的那一行里取不带 www. 的名字（不打印）
SITE_PATH="$(readlink -f /etc/nginx/sites-enabled/default </dev/null 2>/dev/null || true)"
ORIGIN=""
if [ -n "$SITE_PATH" ] && sudo -n test -f "$SITE_PATH" </dev/null; then
  ANCHORS="$(sudo -n awk '/^[[:space:]]*server_name .*# managed by Certbot[[:space:]]*$/ { n++ } END { print n + 0 }' "$SITE_PATH" </dev/null || true)"
  if [ "$ANCHORS" = "1" ]; then
    NAMES="$(sudo -n awk '/^[[:space:]]*server_name .*# managed by Certbot[[:space:]]*$/ { sub(/#.*$/, ""); gsub(/;/, " "); for (i = 2; i <= NF; i++) print $i }' "$SITE_PATH" </dev/null || true)"
    BARE="$(printf '%s\n' "$NAMES" | awk 'NF && $0 !~ /^www\./')"
    if [ "$(printf '%s\n' "$BARE" | awk 'NF' | wc -l | tr -d ' ')" = "1" ] && [[ "$BARE" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
      ORIGIN="https://$BARE"
    fi
  fi
fi
if [ -z "$ORIGIN" ]; then
  echo "错误：无法从证书块确定站点地址，未做任何修改。" >&2
  exit 1
fi

# 环境文件已存在时只核对（只输出个数和长度，不输出值）
ENV_STATE=missing
if sudo -n test -f "$ENV_FILE" </dev/null; then
  ENV_STATE=kept
  KEY_INFO="$(sudo -n awk -F= '$1 == "PB_ENCRYPTION_KEY" { n++; l = length(substr($0, index($0, "=") + 1)) } END { print n + 0, l + 0 }' "$ENV_FILE" </dev/null)"
  if [ "$KEY_INFO" != "1 32" ]; then
    echo "错误：环境文件已存在，但加密钥匙缺失、不止一行或长度不是 32。没有改文件。" >&2
    exit 1
  fi
  ORIGIN_COUNT="$(sudo -n awk -F= '$1 == "USJ_ORIGIN" { n++ } END { print n + 0 }' "$ENV_FILE" </dev/null)"
  STORED_ORIGIN="$(sudo -n awk -F= '$1 == "USJ_ORIGIN" { print substr($0, index($0, "=") + 1) }' "$ENV_FILE" </dev/null)"
  if [ "$ORIGIN_COUNT" != "1" ] || [ "$STORED_ORIGIN" != "$ORIGIN" ]; then
    echo "错误：环境文件里的站点地址缺失，或与证书块里的不一致。没有改文件。" >&2
    exit 1
  fi
  unset STORED_ORIGIN
else
  NEED_CHANGE=yes
fi

# 会改东西的时候服务不能在运行
if [ "$NEED_CHANGE" = yes ] && systemctl is-active --quiet pocketbase </dev/null 2>/dev/null; then
  echo "错误：PocketBase 服务正在运行，而这次要改东西。请先停掉服务（07-retire-probe.sh 会停），什么都没有改。" >&2
  exit 1
fi

# ---------- 改动 ----------
sudo -n install -d -o root -g pocketbase -m 0750 "$ENV_DIR" </dev/null
sudo -n install -d -o pocketbase -g pocketbase -m 0750 "$HOOK_DIR" </dev/null

if [ "$ENV_STATE" = missing ]; then
  umask 077
  KEY="$(openssl rand -hex 16 </dev/null)"
  if [ "${#KEY}" -ne 32 ]; then
    echo "错误：openssl 没有生成预期长度的随机值。" >&2
    exit 1
  fi
  # 先写到临时文件再换名，避免留下写到一半的环境文件
  sudo -n rm -f "$ENV_FILE.new" </dev/null
  sudo -n install -o root -g pocketbase -m 0640 /dev/null "$ENV_FILE.new" </dev/null
  printf 'PB_ENCRYPTION_KEY=%s\nUSJ_ORIGIN=%s\n' "$KEY" "$ORIGIN" | sudo -n tee "$ENV_FILE.new" >/dev/null
  unset KEY
  NEW_INFO="$(sudo -n awk -F= '$1 == "PB_ENCRYPTION_KEY" { n++; l = length(substr($0, index($0, "=") + 1)) } END { print n + 0, l + 0 }' "$ENV_FILE.new" </dev/null)"
  if [ "$NEW_INFO" != "1 32" ]; then
    sudo -n rm -f "$ENV_FILE.new" </dev/null
    echo "错误：新环境文件写入后核对失败，已删除，没有留下钥匙文件。" >&2
    exit 1
  fi
  sudo -n mv -T "$ENV_FILE.new" "$ENV_FILE" </dev/null
  ENV_STATE=created
fi

MIG_NEW=0
for m in $MIGRATIONS; do
  if [ "$(file_state "$UP/pb_migrations/$m" "$MIG_DIR/$m")" = new ]; then
    sudo -n install -o pocketbase -g pocketbase -m 0640 "$UP/pb_migrations/$m" "$MIG_DIR/$m" </dev/null
    MIG_NEW=$((MIG_NEW + 1))
  fi
done

HOOK_NEW=0
if [ "$(file_state "$UP/pb_hooks/$HOOK" "$HOOK_DIR/$HOOK")" = new ]; then
  sudo -n install -o pocketbase -g pocketbase -m 0640 "$UP/pb_hooks/$HOOK" "$HOOK_DIR/$HOOK" </dev/null
  HOOK_NEW=1
fi

ADMIN_OUT=same
if [ "$ADMIN_STATE" != same ]; then
  sudo -n install -o root -g root -m 0755 "$UP/server/pb-admin.sh" "$ADMIN_DST" </dev/null
  ADMIN_OUT=installed
fi
DRILL_OUT=same
if [ "$DRILL_STATE" != same ]; then
  sudo -n install -o root -g root -m 0755 "$UP/server/restore-drill.sh" "$DRILL_DST" </dev/null
  DRILL_OUT=installed
fi

DONE=done
if [ "$ENV_STATE" = kept ] && [ "$MIG_NEW" -eq 0 ] && [ "$HOOK_NEW" -eq 0 ] && [ "$ADMIN_OUT" = same ] && [ "$DRILL_OUT" = same ]; then
  DONE=already
fi

echo "PB_ENV_FILE=$ENV_STATE"
echo "PB_KEY_LEN_OK=yes"
echo "PB_ORIGIN_SET=yes"
echo "PB_MIGRATIONS_APP=4"
echo "PB_HOOKS=1"
echo "PB_ADMIN_TOOL=$ADMIN_OUT"
echo "DRILL_TOOL=$DRILL_OUT"
echo "PB_CONFIGURE=$DONE"
