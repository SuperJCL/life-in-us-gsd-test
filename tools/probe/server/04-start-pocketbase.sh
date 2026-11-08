#!/usr/bin/env bash
# 04-start-pocketbase.sh —— 批次 B：先确认已有超级用户，再安装 unit 并启动 PocketBase（Phase 6，06-07，D-03、D-05、D-14）
#
# 前提：批次 A 已执行（二进制、迁移、目录都在）；所有者已经在阿里云网页终端建好超级用户（D-05）；
#   已上传并核对过 /tmp/usj-probe-upload/server/pocketbase.service。
# 会改什么（需要所有者批准，D-04）：
#   - 把 unit 装到 /etc/systemd/system/pocketbase.service（root 0644），daemon-reload，enable --now；
#   - 启动 PocketBase：它会在 127.0.0.1:8090 监听，并应用迁移（建 probe_results、probe_pings，收紧 users 规则，建探针账号）。
# 动手之前先只读确认：二进制和 pb_data/data.db 存在，且 _superusers 至少有 1 行。没有超级用户就中止：
#   没有超级用户时 PocketBase 启动会在日志里打印一次性安装链接（令牌形状），不能让它进日志（Pitfall 3）。
#   这个只读查询用 pocketbase 用户运行，不会在数据目录里留下 root 所有的文件。
# 启动失败（30 秒内健康检查不通过）：打印最近日志（令牌形状和安装链接已替换成占位），停掉服务，退出 1，
#   不让它反复重启。8090 不是只绑 127.0.0.1 时同样停掉服务并退出 1。
# 输出：KEY=VALUE。PB_START=done、PB_SERVICE_ENABLED=、PB_JOURNAL_SUSPECT_LINES=N（只报个数，不输出日志内容）、
#   PB_MEMORY_CURRENT_MB=、PB_RSS_MB=、MEM_AVAILABLE_MB=。
# 失败策略：set -euo pipefail；没有 set -x；不回显任何口令；可能读标准输入的命令都带 </dev/null（python 用 heredoc）。
# 回滚：sudo systemctl disable --now pocketbase，然后删除 /etc/systemd/system/pocketbase.service 并 systemctl daemon-reload。
#   /var/lib/pocketbase 保留（里面只有合成数据，Phase 13 正式部署时重装）。

set -euo pipefail

UNIT_SRC=/tmp/usj-probe-upload/server/pocketbase.service
UNIT_DST=/etc/systemd/system/pocketbase.service
PB_BIN=/opt/pocketbase/pocketbase
DB=/var/lib/pocketbase/pb_data/data.db

if [ ! -f "$UNIT_SRC" ]; then
  echo "错误：缺少上传的文件 $UNIT_SRC，请先按批准清单上传。" >&2
  exit 1
fi
if ! sudo -n test -x "$PB_BIN" </dev/null; then
  echo "错误：$PB_BIN 不存在，请先运行批次 A 的 02-install-pocketbase.sh。" >&2
  exit 1
fi
if ! sudo -n test -f "$DB" </dev/null; then
  echo "错误：数据库文件不存在，超级用户还没建（D-05），先完成那一步。" >&2
  exit 1
fi

# ---------- 前置：_superusers 至少 1 行（只读打开） ----------
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
  echo "错误：超级用户还没建（D-05），先完成那一步。" >&2
  exit 1
fi

stop_service() {
  sudo -n systemctl stop pocketbase </dev/null || true
}

# ---------- 安装 unit 并启动 ----------
sudo -n install -o root -g root -m 0644 "$UNIT_SRC" "$UNIT_DST" </dev/null
sudo -n systemctl daemon-reload </dev/null
sudo -n systemctl enable --now pocketbase </dev/null

HEALTHY=no
for _ in $(seq 1 30); do
  if curl -fsS -m 3 http://127.0.0.1:8090/api/health </dev/null >/dev/null 2>&1; then
    HEALTHY=yes
    break
  fi
  sleep 1
done

if [ "$HEALTHY" != "yes" ]; then
  echo "错误：30 秒内健康检查没有通过，已停掉服务。最近日志（令牌形状和安装链接已替换）：" >&2
  sudo -n journalctl -u pocketbase -n 40 --no-pager </dev/null 2>&1 \
    | sed -E 's#[^[:space:]]*pbinstal[^[:space:]]*#<install-link>#g; s#eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*#<token>#g' >&2 || true
  stop_service
  exit 1
fi

# ---------- 8090 只绑 127.0.0.1 ----------
BINDS="$(ss -ltnH 'sport = :8090' </dev/null 2>/dev/null | awk '{print $4}' || true)"
BAD_BIND="$(printf '%s\n' "$BINDS" | awk 'NF && $0 !~ /^127\.0\.0\.1:/' | wc -l | tr -d ' ')"
N_BIND="$(printf '%s\n' "$BINDS" | awk 'NF' | wc -l | tr -d ' ')"
if [ "$N_BIND" -lt 1 ] || [ "$BAD_BIND" -ne 0 ]; then
  echo "错误：8090 不是只绑 127.0.0.1，已停掉服务。" >&2
  stop_service
  exit 1
fi

# ---------- 日志里的可疑行：只报个数 ----------
N_SUSPECT="$(sudo -n journalctl -u pocketbase -n 200 --no-pager </dev/null 2>/dev/null | grep -cE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|pbinstal' || true)"
echo "PB_JOURNAL_SUSPECT_LINES=${N_SUSPECT:-0}"

# ---------- 内存 ----------
MEM_BYTES="$(systemctl show pocketbase -p MemoryCurrent --value </dev/null 2>/dev/null || true)"
case "$MEM_BYTES" in
  ''|*[!0-9]*) MEM_MB="n/a" ;;
  *) MEM_MB=$(( MEM_BYTES / 1048576 )) ;;
esac
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

echo "PB_START=done"
echo "PB_SERVICE_ENABLED=$(systemctl is-enabled pocketbase </dev/null 2>/dev/null || true)"
echo "PB_MEMORY_CURRENT_MB=$MEM_MB"
echo "PB_RSS_MB=$RSS_MB"
echo "MEM_AVAILABLE_MB=${AVAIL_MB:-n/a}"
