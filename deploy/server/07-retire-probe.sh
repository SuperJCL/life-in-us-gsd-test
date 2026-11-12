#!/usr/bin/env bash
# 07-retire-probe.sh —— 退役 Phase 6 的探针：--wipe（清空库）或 --keep（保留库）（Phase 13，13-06，D-10）
#
# 用法：07-retire-probe.sh --wipe   或   07-retire-probe.sh --keep    （缺了参数或别的值退出 2）
# 前提：无（不读上传目录，也不装任何新文件）。是 --wipe 还是 --keep 由所有者在 13-09 单独决定，13-10 执行前再请所有者即时确认一次。
# 两种模式的区别：
#   --wipe：停服务后把 /var/lib/pocketbase/pb_data 整个删掉再建空目录（pocketbase 0700）。库里的探针集合、探针账号、
#     Phase 6 建的超级用户都没了；新的应用迁移和服务器设置迁移在空库上跑，所有者之后用 pb-admin.sh 重建超级用户，
#     新钥匙从第一次保存设置起就生效。守卫：库里只要有任何不是探针账号的用户，或有任何 journey_docs 记录，就拒绝清空（退出 1）。
#   --keep：保留 pb_data 和里面的超级用户，只停服务、删探针迁移文件和探针页；探针集合和探针账号由 13-05 的清理迁移
#     （1794096150_retire_probe.js）在下次启动时删掉，所以 --keep 依赖 03 把那个迁移一起装上。
# 会改什么（需要所有者批准）：
#   - PocketBase 在运行就 systemctl stop pocketbase（不 disable；04 会再 restart 并 enable）；
#   - 删 /var/lib/pocketbase/pb_migrations/ 下的 *_probe_schema.js 和 *_probe_user.js（探针账号的口令本来就公开，在这个迁移文件里）；
#   - 删 /var/www/usj/probe（探针页和 config.js）；
#   - --wipe 时 rm -rf /var/lib/pocketbase/pb_data 后重建空目录。
#   不碰 nginx（探针的 include 由 13-07 的 05 换掉）、不碰二进制、不碰 pocketbase 用户、不碰 /etc/usj 里的钥匙。
# 前置检查（只读，先于任何改动）：--wipe 时以 pocketbase 用户只读打开 data.db（存在时），数 users 里邮箱不匹配
#   ^probe-[0-9a-f]{8}@example\.com$ 的行和 journey_docs 的行（表不存在算 0）；数不出来也拒绝。停服务之后、rm -rf 之前再数一次。
# 输出：KEY=VALUE。PB_SERVICE_ACTIVE=inactive、PROBE_MIGRATIONS_REMOVED=N、PROBE_PAGE=removed|absent、
#   PB_DATA=wiped|kept、PROBE_RETIRE=done|already（什么都不用删时 already）。
# 失败策略：set -euo pipefail；没有 set -x；不输出任何字段内容、邮箱、口令；可能读标准输入的命令都带 </dev/null（python 用 heredoc）。
# 回滚：--keep 没有需要回滚的东西（被删的只是合成探针数据和探针页）；--wipe 不可回滚（库已删），
#   所以要所有者在 13-09 单独决定，并且上面的守卫挡住了任何非探针数据。

set -euo pipefail

usage() {
  echo "用法：07-retire-probe.sh --wipe | --keep" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi
MODE="$1"
case "$MODE" in
  --wipe|--keep) ;;
  *)
    usage
    exit 2
    ;;
esac

DB=/var/lib/pocketbase/pb_data/data.db
DATA_DIR=/var/lib/pocketbase/pb_data
MIG_DIR=/var/lib/pocketbase/pb_migrations
PROBE_DIR=/var/www/usj/probe

guard_non_probe_data() {
  # 库不存在算没有数据；读不出来就当有（fail closed）
  if ! sudo -n test -f "$DB" </dev/null; then
    return 0
  fi
  local counts
  counts="$(sudo -n -u pocketbase python3 -I - <<'PY' 2>/dev/null || true
import re
import sqlite3

PROBE = re.compile(r"^probe-[0-9a-f]{8}@example\.com$")
try:
    con = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True, timeout=3)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    users = 0
    if "users" in tables:
        for (email,) in con.execute("SELECT email FROM users"):
            if not PROBE.match(email or ""):
                users += 1
    docs = 0
    if "journey_docs" in tables:
        docs = con.execute("SELECT COUNT(*) FROM journey_docs").fetchone()[0]
    print(users, docs)
except Exception:
    print("unreadable")
PY
)"
  if ! [[ "$counts" =~ ^[0-9]+\ [0-9]+$ ]]; then
    echo "错误：无法只读读出库里的用户和文档个数，拒绝清空。" >&2
    exit 1
  fi
  if [ "$counts" != "0 0" ]; then
    echo "错误：库里有非探针数据，拒绝清空。（非探针用户个数和 journey_docs 个数：$counts）" >&2
    exit 1
  fi
}

# ---------- 前置（只读） ----------
if [ "$MODE" = "--wipe" ]; then
  guard_non_probe_data
fi

# ---------- 改动 ----------
CHANGED=no

if systemctl is-active --quiet pocketbase </dev/null 2>/dev/null; then
  sudo -n systemctl stop pocketbase </dev/null
  CHANGED=yes
fi
ACTIVE="$(systemctl is-active pocketbase </dev/null 2>/dev/null || true)"
if [ "$ACTIVE" = "active" ] || [ "$ACTIVE" = "activating" ]; then
  echo "错误：PocketBase 服务没有停下来。" >&2
  exit 1
fi

REMOVED="$({ sudo -n find "$MIG_DIR" -maxdepth 1 -type f \( -name '*_probe_schema.js' -o -name '*_probe_user.js' \) </dev/null 2>/dev/null || true; } | wc -l | tr -d ' ')"
if [ "$REMOVED" -gt 0 ]; then
  sudo -n find "$MIG_DIR" -maxdepth 1 -type f \( -name '*_probe_schema.js' -o -name '*_probe_user.js' \) -delete </dev/null
  CHANGED=yes
fi

PROBE_PAGE=absent
if sudo -n test -e "$PROBE_DIR" </dev/null; then
  sudo -n rm -rf "$PROBE_DIR" </dev/null
  PROBE_PAGE=removed
  CHANGED=yes
fi

PB_DATA=kept
if [ "$MODE" = "--wipe" ]; then
  # 服务已经停了，删之前再核对一次
  guard_non_probe_data
  if [ -n "$(sudo -n find "$DATA_DIR" -mindepth 1 -print -quit </dev/null 2>/dev/null || true)" ]; then
    sudo -n rm -rf "$DATA_DIR" </dev/null
    CHANGED=yes
  fi
  sudo -n install -d -o pocketbase -g pocketbase -m 0700 "$DATA_DIR" </dev/null
  PB_DATA=wiped
fi

DONE=done
if [ "$CHANGED" = no ]; then
  DONE=already
fi

echo "PB_SERVICE_ACTIVE=${ACTIVE:-inactive}"
echo "PROBE_MIGRATIONS_REMOVED=$REMOVED"
echo "PROBE_PAGE=$PROBE_PAGE"
echo "PB_DATA=$PB_DATA"
echo "PROBE_RETIRE=$DONE"
