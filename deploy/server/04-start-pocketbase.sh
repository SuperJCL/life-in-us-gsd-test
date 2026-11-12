#!/usr/bin/env bash
# 04-start-pocketbase.sh —— 装 unit、restart、健康检查、只绑回环；失败就 disable --now（Phase 13，13-06，D-11、WR-08、IN-09）
#
# 用法：04-start-pocketbase.sh /tmp/usj-deploy.<随机>
#   第一个参数是上传目录（mktemp -d 建的 0700 目录，属于当前用户，里面有 SHA256SUMS）；本脚本只读 server/pocketbase.service。
# 前提：02 和 03 已经跑完（二进制、环境文件、迁移、钩子都在）；所有者已经在阿里云网页终端用 pb-admin.sh 建好超级用户。
# 动手之前先只读确认（任何一项不满足就退出 1，什么都不改）：
#   - 上传目录格式、属主、权限，server/pocketbase.service 在 SHA256SUMS 里恰好一行并通过 sha256sum -c（IN-09）；
#   - 二进制可执行；pb_data/data.db 存在，_superusers 至少 1 行（以 pocketbase 用户只读打开，不会留下 root 所有的文件）。
#     没有超级用户时 PocketBase 启动会在日志里打印一次性安装链接（令牌形状），不能让它进日志；
#   - 环境文件存在，钥匙长度是 32，站点地址非空且以 https:// 开头（只核对，不输出它们）；
#   - 4 个应用和服务器迁移文件、pb_hooks/backup-watch.pb.js 都在。
# 会改什么（需要所有者批准）：
#   - 新旧 unit 的 sha256 不同才安装到 /etc/systemd/system/pocketbase.service（root 0644）并 daemon-reload（PB_UNIT=updated|same）；
#   - systemctl enable pocketbase，再 systemctl restart pocketbase。必须 restart：新迁移和钩子只在启动时生效，
#     已经在运行的服务用 enable --now 不会重启（WR-08）；
#   - restart 之后：30 秒健康检查；ss 确认 8090 只绑 127.0.0.1。任何一项失败：打印最近 20 行日志
#     （令牌形状、安装链接和主机名已替换成占位）、systemctl disable --now pocketbase（不让它反复重启，重启后也不会自己起来）、退出 1。
#   - 启动成功后只读检查 _params 里 settings 的值不是合法 JSON，即设置在库里是密文（PB_SETTINGS_ENCRYPTED）。
# 输出：KEY=VALUE。PB_UNIT=updated|same、PB_START=done、PB_SERVICE_ENABLED=enabled、PB_LISTEN_LOOPBACK_ONLY=yes、
#   PB_SETTINGS_ENCRYPTED=yes|no、PB_RSS_MB=、MEM_AVAILABLE_MB=。
# 失败策略：set -euo pipefail；没有 set -x；不回显钥匙或口令；可能读标准输入的命令都带 </dev/null（python 用 heredoc）。
# 回滚：sudo systemctl disable --now pocketbase，然后删除 /etc/systemd/system/pocketbase.service 并 systemctl daemon-reload。
#   /var/lib/pocketbase 和 /etc/usj 保留（里面有数据和钥匙）。

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
verify_uploads server/pocketbase.service

UNIT_SRC="$UP/server/pocketbase.service"
UNIT_DST=/etc/systemd/system/pocketbase.service
PB_BIN=/opt/pocketbase/pocketbase
DB=/var/lib/pocketbase/pb_data/data.db
ENV_FILE=/etc/usj/pocketbase.env
MIG_DIR=/var/lib/pocketbase/pb_migrations
HOOK_FILE=/var/lib/pocketbase/pb_hooks/backup-watch.pb.js

# ---------- 前置（只读） ----------
if ! sudo -n test -x "$PB_BIN" </dev/null; then
  echo "错误：$PB_BIN 不存在，请先运行 02-install-pocketbase.sh。" >&2
  exit 1
fi
if ! sudo -n test -f "$DB" </dev/null; then
  echo "错误：数据库文件不存在，超级用户还没建，先完成那一步（pb-admin.sh superuser upsert）。" >&2
  exit 1
fi

N_SU="$(sudo -n -u pocketbase python3 -I - <<'PY' 2>/dev/null || true
import sqlite3
con = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True)
print(con.execute("SELECT COUNT(*) FROM _superusers").fetchone()[0])
PY
)"
case "$N_SU" in
  ''|*[!0-9]*) N_SU=0 ;;
esac
if [ "$N_SU" -lt 1 ]; then
  echo "错误：超级用户还没建，先完成那一步（pb-admin.sh superuser upsert）。" >&2
  exit 1
fi

if ! sudo -n test -f "$ENV_FILE" </dev/null; then
  echo "错误：环境文件不存在，请先运行 03-configure-pocketbase.sh。" >&2
  exit 1
fi
ENV_INFO="$(sudo -n awk -F= '
  $1 == "PB_ENCRYPTION_KEY" { n++; kl = length(substr($0, index($0, "=") + 1)) }
  $1 == "USJ_ORIGIN" { m++; o = substr($0, index($0, "=") + 1) }
  END { print n + 0, kl + 0, m + 0, (o ~ /^https:\/\/./ ? "ok" : "bad") }' "$ENV_FILE" </dev/null)"
if [ "$ENV_INFO" != "1 32 1 ok" ]; then
  echo "错误：环境文件里的钥匙长度不是 32，或站点地址缺失、不是 https:// 开头。" >&2
  exit 1
fi
for m in 1794096000_users_lockdown.js 1794096100_journey_docs.js 1794096150_retire_probe.js 1794096200_server_settings.js; do
  if ! sudo -n test -f "$MIG_DIR/$m" </dev/null; then
    echo "错误：缺少迁移文件 $m，请先运行 03-configure-pocketbase.sh。" >&2
    exit 1
  fi
done
if ! sudo -n test -f "$HOOK_FILE" </dev/null; then
  echo "错误：缺少钩子文件 backup-watch.pb.js，请先运行 03-configure-pocketbase.sh。" >&2
  exit 1
fi

# ---------- 失败路径：不让它反复重启，也不让它开机自己起来 ----------
fail_and_disable() {
  echo "错误：$1 已执行 systemctl disable --now pocketbase。最近日志（令牌形状、安装链接和主机名已替换）：" >&2
  sudo -n journalctl -u pocketbase -n 20 --no-pager </dev/null 2>&1 \
    | sed -E 's#[^[:space:]]*pbinstal[^[:space:]]*#<install-link>#g; s#eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*#<token>#g; s#https?://[^[:space:]/]+#<origin>#g' >&2 || true
  sudo -n systemctl disable --now pocketbase </dev/null || true
  exit 1
}

# ---------- 安装 unit（内容不同才装）、enable、restart ----------
NEW_SUM="$(sha256sum "$UNIT_SRC" </dev/null | awk '{print $1}')"
OLD_SUM="$(sudo -n sha256sum "$UNIT_DST" </dev/null 2>/dev/null | awk '{print $1}' || true)"
PB_UNIT=same
if [ "$NEW_SUM" != "$OLD_SUM" ]; then
  sudo -n install -o root -g root -m 0644 "$UNIT_SRC" "$UNIT_DST" </dev/null
  sudo -n systemctl daemon-reload </dev/null
  PB_UNIT=updated
fi
sudo -n systemctl enable pocketbase </dev/null
if ! sudo -n systemctl restart pocketbase </dev/null; then
  fail_and_disable "systemctl restart 失败。"
fi

HEALTHY=no
for _ in $(seq 1 30); do
  if curl -fsS -m 3 http://127.0.0.1:8090/api/health </dev/null >/dev/null 2>&1; then
    HEALTHY=yes
    break
  fi
  sleep 1
done
if [ "$HEALTHY" != "yes" ]; then
  fail_and_disable "30 秒内健康检查没有通过。"
fi

# ---------- 8090 只绑 127.0.0.1 ----------
BINDS="$(ss -ltnH 'sport = :8090' </dev/null 2>/dev/null | awk '{print $4}' || true)"
BAD_BIND="$(printf '%s\n' "$BINDS" | awk 'NF && $0 !~ /^127\.0\.0\.1:/' | wc -l | tr -d ' ')"
N_BIND="$(printf '%s\n' "$BINDS" | awk 'NF' | wc -l | tr -d ' ')"
if [ "$N_BIND" -lt 1 ] || [ "$BAD_BIND" -ne 0 ]; then
  fail_and_disable "8090 不是只绑 127.0.0.1。"
fi

ENABLED="$(systemctl is-enabled pocketbase </dev/null 2>/dev/null || true)"
if [ "$ENABLED" != "enabled" ]; then
  fail_and_disable "服务不是 enabled，重启后不会自己起来。"
fi

# ---------- 设置在库里是密文（不是合法 JSON） ----------
ENCRYPTED="$(sudo -n -u pocketbase python3 -I - <<'PY' 2>/dev/null || true
import json
import sqlite3

con = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True, timeout=3)
row = con.execute("SELECT value FROM _params WHERE id = 'settings'").fetchone()
if row is None:
    print("no")
else:
    value = row[0]
    try:
        text = value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)
        json.loads(text)
        print("no")
    except Exception:
        print("yes")
PY
)"
case "$ENCRYPTED" in
  yes|no) ;;
  *) ENCRYPTED=no ;;
esac

# ---------- 内存 ----------
MAIN_PID="$(systemctl show pocketbase -p MainPID --value </dev/null 2>/dev/null || true)"
RSS_KB=""
case "$MAIN_PID" in
  ''|0|*[!0-9]*) ;;
  *) RSS_KB="$(ps -o rss= -p "$MAIN_PID" </dev/null 2>/dev/null | tr -d ' ' || true)" ;;
esac
case "$RSS_KB" in
  ''|*[!0-9]*) RSS_MB="n/a" ;;
  *) RSS_MB=$(( RSS_KB / 1024 )) ;;
esac
AVAIL_MB="$(free -m </dev/null 2>/dev/null | awk '/^Mem:/{print $7}' || true)"

echo "PB_UNIT=$PB_UNIT"
echo "PB_START=done"
echo "PB_SERVICE_ENABLED=$ENABLED"
echo "PB_LISTEN_LOOPBACK_ONLY=yes"
echo "PB_SETTINGS_ENCRYPTED=$ENCRYPTED"
echo "PB_RSS_MB=$RSS_MB"
echo "MEM_AVAILABLE_MB=${AVAIL_MB:-n/a}"
