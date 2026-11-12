#!/usr/bin/env bash
# restore-drill.sh —— 服务器上的备份恢复演练（Phase 13，13-07，D-05（所有者 2026-11-12 修订）、OPS-01、T-13-21、T-13-23、T-13-40）
#
# 装成 /usr/local/sbin/usj-restore-drill（03-configure-pocketbase.sh 负责），以 root 运行：sudo usj-restore-drill。不接受任何参数。
# 线上实例只读、从不停止：线上库只以只读方式打开（SQLite mode=ro），从不对线上的 pocketbase 单元执行 stop、start、restart、disable。
#
# 做什么：在服务器上另起一个临时实例（127.0.0.1:8091、/var/lib/pocketbase-drill、systemd-run 的临时单元 usj-drill，
#   RuntimeMaxSec=900、MemoryMax=300M、不加载钩子），用线上库的只读一致副本起步（副本里有加密保存的 R2 设置，
#   所以任何人都不用重新输入 R2 凭据），然后：列出 R2 里的自动备份、写入并删除一个演练备份（证明 R2 令牌能写能删，A1）、
#   把最新的自动备份恢复进临时实例、停掉临时实例后只读核对，最后删掉临时实例和它的副本。
#
# 步骤（每一步对应的风险控制）：
#   1. 18:40–19:20 UTC 之间拒绝运行（输出 DRILL_WINDOW_OK=no，退出 1）：自动备份在 19:00 UTC，避免临时实例和线上同时碰 R2。
#   2. 前置（只读）：线上 http://127.0.0.1:8090/api/health 是 200；演练目录不存在；usj-drill 单元不在运行；8091 空闲；环境文件在。
#   2.5 守卫（在复制任何东西、建任何目录、systemd-run 之前）：以 pocketbase 用户只读打开线上库，数 users 里邮箱不符合测试账号约定
#       （^test-[a-z0-9-]+@example\.com$）的行，和 owner 不是测试账号的 journey_docs 行。任一大于 0（或读不出来）就输出
#       DRILL_GUARD=refused，以 1 退出，什么都没有复制；都为 0 输出 DRILL_GUARD=ok。真实账号和真实数据因此永远进不了演练。
#   3. trap cleanup EXIT：无论成败，都停掉 usj-drill、reset-failed、删除演练目录（输出 DRILL_CLEANUP=done）。
#   4. 建演练目录（pocketbase 所有，0700）；用 SQLite 备份接口从线上库的只读连接复制一份一致的 data.db；
#      只在这份副本里把 _superusers 的 mfa、otp、authAlert 置为假（临时超级用户才能用口令登录，也不发登录提醒邮件）。
#   5. 随机生成临时超级用户 drill-<十六进制>@example.com 和口令（只在变量里），用 systemd-run 在副本上 superuser upsert
#      （钥匙只经环境文件，不进参数）。
#   6. systemd-run --unit=usj-drill 起临时实例；30 秒健康检查。临时单元看不到线上数据目录（InaccessiblePaths），
#      只能写演练目录。
#   7. 登录：JSON 体经标准输入，口令不进 curl 参数；令牌写进演练目录里 0600 的头文件。
#   8. PATCH /api/settings 把 backups.cron 置空、smtp.enabled 置假（DRILL_TEMP_ISOLATED=yes）——在列出备份之前，
#      临时实例因此不会按 cron 往 R2 写自动备份，也发不出邮件（T-13-21）。
#   9. GET /api/backups：数 @auto_pb_backup_ 开头的备份（0 个就失败），取最新的，算距现在的小时数。
#   10. POST /api/backups 建 drill_<UTC 时间戳>.zip（不带自动前缀，所以不会被保留数清理），等它出现在列表里（DRILL_R2_WRITE=ok），
#       再 DELETE，等它消失（DRILL_R2_DELETE=ok；删不掉就失败，说明 R2 令牌没有删除权限；失败时请在后台手动删掉 drill_ 开头的备份）。
#   11. POST /api/backups/<URL 编码的最新自动备份 key>/restore（key 里的 @ 编码成 %40），最多等 60 秒健康检查恢复
#       （DRILL_RESTORE=ok），随即停掉 usj-drill。
#   12. 只读核对（python3 -I，两边都用 mode=ro）：恢复库 PRAGMA integrity_check 是 ok；恢复库只含测试账号；
#       线上库里创建时间不晚于备份时间的用户 id 集合等于恢复库的用户 id 集合；恢复库的每份 journey_docs 在线上都有同 id 的记录，
#       线上 updated 不晚于备份时间的逐份比较 data 的 sha256；至少 1 个用户同时有 state 和 plan 两份文档。
#   13. 由 EXIT trap 清理；最后一行 DRILL_RESULT=PASS 或 DRILL_RESULT=FAIL（任何一步失败都是 FAIL 并以 1 退出）。
#
# 输出：只输出 DRILL_ 开头的 KEY=VALUE：DRILL_WINDOW_OK、DRILL_GUARD、DRILL_TEMP_ISOLATED、DRILL_AUTO_BACKUPS、DRILL_NEWEST_AGE_H、
#   DRILL_R2_WRITE、DRILL_R2_DELETE、DRILL_RESTORE、DRILL_INTEGRITY、DRILL_RESTORED_TEST_ONLY、DRILL_USERS_MATCH、DRILL_DOCS、
#   DRILL_DOCS_COMPARED、DRILL_DOCS_MISMATCH、DRILL_DOCS_CHANGED_SINCE、DRILL_USERS_WITH_BOTH_DOCS、DRILL_CLEANUP、DRILL_RESULT。
#   不输出邮箱、令牌、口令，也不输出备份名里的时间以外的任何内容；错误说明（中文）走标准错误。
# 失败策略：set -euo pipefail；没有 set -x；不回显口令和令牌；可能读标准输入的命令都带 </dev/null（python 用 heredoc）。
# 回滚：线上没有被改动，不需要回滚。临时实例和副本由 EXIT trap 删除；万一脚本被强行杀掉，手工执行：
#   sudo systemctl stop usj-drill; sudo systemctl reset-failed usj-drill; sudo rm -rf /var/lib/pocketbase-drill
#   （RuntimeMaxSec=900 也会在 15 分钟后自动结束临时单元）。

set -euo pipefail

DRILL_DIR=/var/lib/pocketbase-drill
ENV_FILE=/etc/usj/pocketbase.env
PB_BIN=/opt/pocketbase/pocketbase
UNIT=usj-drill
BASE=http://127.0.0.1:8091
RESULT=FAIL

die() {
  echo "错误：$1" >&2
  exit 1
}

# 还没有建任何东西时的退出：只报告结果
fail_early() {
  echo "错误：$1" >&2
  echo "DRILL_RESULT=FAIL"
  exit 1
}

# ---------- 入口 ----------
if [ "$(id -u)" != "0" ]; then
  echo "错误：必须以 root 运行（sudo usj-restore-drill）。" >&2
  exit 2
fi
if [ "$#" -ne 0 ]; then
  echo "错误：不接受参数。" >&2
  exit 2
fi

# ---------- 1. 时间窗：18:40–19:20 UTC 之间不运行 ----------
HHMM=$((10#$(date -u +%H%M)))
if [ "$HHMM" -ge 1840 ] && [ "$HHMM" -le 1920 ]; then
  echo "DRILL_WINDOW_OK=no"
  fail_early "现在是 18:40–19:20 UTC 之间（自动备份时间），不运行恢复演练。"
fi
echo "DRILL_WINDOW_OK=yes"

# ---------- 2. 前置（只读） ----------
if [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:8090/api/health </dev/null || true)" != "200" ]; then
  fail_early "线上实例的健康检查不是 200。"
fi
if [ -e "$DRILL_DIR" ]; then
  fail_early "演练目录已经存在（上一次演练没有清理？），请先确认后手工删除。"
fi
if systemctl is-active --quiet "$UNIT" </dev/null 2>/dev/null; then
  fail_early "usj-drill 单元已经在运行。"
fi
if [ -n "$(ss -ltnH 'sport = :8091' </dev/null 2>/dev/null || true)" ]; then
  fail_early "8091 端口被占用。"
fi
if [ ! -f "$ENV_FILE" ] || [ ! -x "$PB_BIN" ]; then
  fail_early "环境文件或 PocketBase 程序不存在。"
fi
if ! command -v python3 </dev/null >/dev/null 2>&1 || ! command -v runuser </dev/null >/dev/null 2>&1; then
  fail_early "缺少 python3 或 runuser。"
fi

# ---------- 2.5 守卫：只有测试账号的数据才许演练（在复制任何东西之前，只读） ----------
GUARD="$(runuser -u pocketbase -- python3 -I - <<'PY' 2>/dev/null || echo "ERR"
import re
import sqlite3

TEST = re.compile(r"^test-[a-z0-9-]+@example\.com$")
con = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True, timeout=10)
users = {r[0]: (r[1] or "") for r in con.execute("select id, email from users")}
bad_users = sum(1 for e in users.values() if not TEST.match(e))
bad_docs = sum(1 for (o,) in con.execute("select owner from journey_docs") if not TEST.match(users.get(o, "")))
print(bad_users, bad_docs)
PY
)"
if [ "$GUARD" != "0 0" ]; then
  echo "DRILL_GUARD=refused"
  echo "线上库里已有测试账号以外的数据（或读不出来），恢复演练拒绝运行，什么都没有复制。" >&2
  echo "DRILL_RESULT=FAIL"
  exit 1
fi
echo "DRILL_GUARD=ok"

# ---------- 3. 清理（无论成败） ----------
cleanup() {
  local rc=$?
  trap - EXIT
  set +e
  systemctl stop "$UNIT" </dev/null >/dev/null 2>&1
  systemctl reset-failed "$UNIT" </dev/null >/dev/null 2>&1
  rm -rf "$DRILL_DIR"
  if [ -e "$DRILL_DIR" ]; then
    echo "DRILL_CLEANUP=incomplete"
    echo "DRILL_RESULT=FAIL"
    exit 1
  fi
  echo "DRILL_CLEANUP=done"
  if [ "$rc" -eq 0 ] && [ "$RESULT" = "PASS" ]; then
    echo "DRILL_RESULT=PASS"
    exit 0
  fi
  echo "DRILL_RESULT=FAIL"
  exit 1
}
trap cleanup EXIT

# ---------- 4. 演练目录和线上库的只读一致副本 ----------
install -d -o pocketbase -g pocketbase -m 0700 "$DRILL_DIR" "$DRILL_DIR/pb_data" "$DRILL_DIR/pb_migrations" "$DRILL_DIR/pb_hooks"

runuser -u pocketbase -- python3 -I - <<'PY' || die "复制线上库的只读副本失败。"
import json
import sqlite3

src = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True, timeout=10)
dst = sqlite3.connect("/var/lib/pocketbase-drill/pb_data/data.db")
src.backup(dst)
dst.close()
src.close()

# 只在副本里关掉两步验证和登录提醒
con = sqlite3.connect("/var/lib/pocketbase-drill/pb_data/data.db")
row = con.execute("select options from _collections where name = '_superusers'").fetchone()
opts = json.loads(row[0])
for k in ("mfa", "otp", "authAlert"):
    opts.setdefault(k, {})["enabled"] = False
con.execute("UPDATE _collections SET options = ? WHERE name = '_superusers'", (json.dumps(opts),))
con.commit()
con.close()
PY

# ---------- 5. 临时超级用户（口令只在变量里） ----------
EM="drill-$(openssl rand -hex 6 </dev/null)@example.com"
PW="$(openssl rand -hex 16 </dev/null)"
PB_FLAGS=(--dir="$DRILL_DIR/pb_data" --migrationsDir="$DRILL_DIR/pb_migrations" --hooksDir="$DRILL_DIR/pb_hooks" --automigrate=false --encryptionEnv=PB_ENCRYPTION_KEY)
systemd-run --wait --pipe --quiet --collect --property=User=pocketbase --property=Group=pocketbase --property=EnvironmentFile="$ENV_FILE" \
  "$PB_BIN" "${PB_FLAGS[@]}" superuser upsert "$EM" "$PW" </dev/null >/dev/null || die "在副本里建临时超级用户失败。"

# ---------- 6. 临时实例 ----------
systemd-run --unit="$UNIT" --collect --quiet \
  --property=User=pocketbase --property=Group=pocketbase \
  --property=EnvironmentFile="$ENV_FILE" --property=Environment=GOMEMLIMIT=200MiB \
  --property=RuntimeMaxSec=900 --property=MemoryMax=300M \
  --property=WorkingDirectory="$DRILL_DIR" --property=PrivateTmp=true --property=NoNewPrivileges=true \
  --property=ProtectSystem=strict --property=ReadWritePaths="$DRILL_DIR" --property=InaccessiblePaths=/var/lib/pocketbase \
  "$PB_BIN" serve --http=127.0.0.1:8091 "${PB_FLAGS[@]}" --hooksWatch=false </dev/null || die "起临时实例失败。"

wait_health() {
  local tries="$1" i
  for i in $(seq 1 "$tries"); do
    if curl -fsS -m 3 "$BASE/api/health" </dev/null >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}
if ! wait_health 30; then
  die "临时实例 30 秒内健康检查没有通过。"
fi

# ---------- 7. 登录：JSON 体经标准输入，令牌写进 0600 的头文件 ----------
RESP="$(printf '{"identity":"%s","password":"%s"}' "$EM" "$PW" | curl -fsS -m 15 -H 'Content-Type: application/json' --data-binary @- "$BASE/api/collections/_superusers/auth-with-password")" || die "临时超级用户登录失败。"
TOKEN="$(printf '%s' "$RESP" | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["token"])')" || die "登录响应里没有令牌。"
umask 077
printf 'Authorization: %s\n' "$TOKEN" > "$DRILL_DIR/auth.hdr"
unset RESP TOKEN PW EM

api() {
  curl -fsS -m 120 -H "@$DRILL_DIR/auth.hdr" "$@"
}

# ---------- 8. 先关临时实例的备份 cron 和 SMTP（在列出备份之前） ----------
printf '%s' '{"backups":{"cron":""},"smtp":{"enabled":false}}' | api -X PATCH -H 'Content-Type: application/json' --data-binary @- "$BASE/api/settings" >/dev/null || die "关闭临时实例的备份 cron 和 SMTP 失败。"
ISO="$(api "$BASE/api/settings" | python3 -I -c 'import json,sys; s = json.load(sys.stdin); print("yes" if s["backups"]["cron"] == "" and s["smtp"]["enabled"] is False else "no")')" || die "读不到临时实例的设置。"
if [ "$ISO" != "yes" ]; then
  die "临时实例的备份 cron 或 SMTP 没有关掉。"
fi
echo "DRILL_TEMP_ISOLATED=yes"

# ---------- 9. R2 里的自动备份 ----------
INFO="$(api "$BASE/api/backups" | python3 -I -c '
import json
import sys
from datetime import datetime, timezone

items = json.load(sys.stdin)
auto = [b for b in items if str(b.get("key", "")).startswith("@auto_pb_backup_")]
if not auto:
    print("0|0||")
    sys.exit(0)
auto.sort(key=lambda b: b["modified"])
newest = auto[-1]
dt = datetime.strptime(newest["modified"].replace("T", " ")[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
age = int((datetime.now(timezone.utc) - dt).total_seconds() // 3600)
print("%d|%d|%s|%s" % (len(auto), age, newest["modified"], newest["key"]))
')" || die "读不到备份列表。"
IFS='|' read -r N_AUTO AGE_H BACKUP_TS NEWEST_KEY <<<"$INFO"
echo "DRILL_AUTO_BACKUPS=$N_AUTO"
echo "DRILL_NEWEST_AGE_H=$AGE_H"
if [ "$N_AUTO" -lt 1 ] || [ -z "$NEWEST_KEY" ]; then
  die "R2 里没有自动备份。"
fi

# ---------- 10. 写入并删除一个演练备份（证明 R2 令牌能写能删） ----------
DNAME="drill_$(date -u +%Y%m%d%H%M%S).zip"
printf '{"name":"%s"}' "$DNAME" | api -X POST -H 'Content-Type: application/json' --data-binary @- "$BASE/api/backups" >/dev/null || die "在 R2 里创建演练备份失败。"
SEEN=no
for _ in $(seq 1 30); do
  LIST="$(api "$BASE/api/backups")" || LIST=""
  case "$LIST" in
    *"\"$DNAME\""*) SEEN=yes; break ;;
  esac
  sleep 2
done
if [ "$SEEN" != "yes" ]; then
  die "演练备份没有出现在 R2 的列表里。"
fi
echo "DRILL_R2_WRITE=ok"
api -X DELETE "$BASE/api/backups/$DNAME" >/dev/null || die "删除演练备份失败（R2 令牌可能没有删除权限）；请在后台手动删掉 drill_ 开头的备份。"
GONE=no
for _ in $(seq 1 30); do
  LIST="$(api "$BASE/api/backups")" || LIST=""
  case "$LIST" in
    *"\"$DNAME\""*) ;;
    *) GONE=yes; break ;;
  esac
  sleep 2
done
if [ "$GONE" != "yes" ]; then
  die "演练备份删不掉（R2 令牌可能没有删除权限）；请在后台手动删掉 drill_ 开头的备份。"
fi
echo "DRILL_R2_DELETE=ok"

# ---------- 11. 恢复最新的自动备份 ----------
ENC_KEY="$(printf '%s' "$NEWEST_KEY" | python3 -I -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip(), safe=""))')" || die "备份名编码失败。"
api -X POST "$BASE/api/backups/$ENC_KEY/restore" >/dev/null || die "恢复接口返回错误。"
sleep 3
if ! wait_health 60; then
  die "恢复后 60 秒内临时实例没有恢复健康检查。"
fi
echo "DRILL_RESTORE=ok"
systemctl stop "$UNIT" </dev/null || die "停不掉临时实例。"

# ---------- 12. 只读核对 ----------
VERIFY="$(runuser -u pocketbase -- env BACKUP_TS="$BACKUP_TS" python3 -I - <<'PY' 2>/dev/null || echo "DRILL_VERIFY_ERROR=1"
import hashlib
import os
import re
import sqlite3

TEST = re.compile(r"^test-[a-z0-9-]+@example\.com$")
ts = os.environ["BACKUP_TS"]
live = sqlite3.connect("file:/var/lib/pocketbase/pb_data/data.db?mode=ro", uri=True, timeout=10)
rest = sqlite3.connect("file:/var/lib/pocketbase-drill/pb_data/data.db?mode=ro", uri=True, timeout=10)
out = {}

out["DRILL_INTEGRITY"] = "ok" if rest.execute("PRAGMA integrity_check").fetchone()[0] == "ok" else "fail"

ru = {r[0]: (r[1] or "") for r in rest.execute("select id, email from users")}
rdocs = rest.execute("select id, owner, kind, data from journey_docs").fetchall()
only_test = all(TEST.match(e) for e in ru.values()) and all(TEST.match(ru.get(o, "")) for (_, o, _, _) in rdocs)
out["DRILL_RESTORED_TEST_ONLY"] = "yes" if only_test else "no"

cols = [r[1] for r in live.execute("PRAGMA table_info(users)")]
if "created" in cols:
    live_ids = {r[0] for r in live.execute("select id from users where created <= ?", (ts,))}
    out["DRILL_USERS_MATCH"] = "yes" if live_ids == set(ru) else "no"
else:
    live_ids = {r[0] for r in live.execute("select id from users")}
    out["DRILL_USERS_MATCH"] = "yes" if set(ru) <= live_ids else "no"


def digest(d):
    return hashlib.sha256(d if isinstance(d, bytes) else str(d).encode("utf-8")).hexdigest()


compared = 0
mismatch = 0
changed = 0
for (doc_id, _owner, _kind, data) in rdocs:
    row = live.execute("select updated, data from journey_docs where id = ?", (doc_id,)).fetchone()
    if row is None:
        mismatch += 1
    elif row[0] <= ts:
        compared += 1
        if digest(row[1]) != digest(data):
            mismatch += 1
    else:
        changed += 1
out["DRILL_DOCS"] = len(rdocs)
out["DRILL_DOCS_COMPARED"] = compared
out["DRILL_DOCS_MISMATCH"] = mismatch
out["DRILL_DOCS_CHANGED_SINCE"] = changed

kinds = {}
for (_id, owner, kind, _data) in rdocs:
    kinds.setdefault(owner, set()).add(kind)
out["DRILL_USERS_WITH_BOTH_DOCS"] = sum(1 for v in kinds.values() if {"state", "plan"} <= v)

for k, v in out.items():
    print("%s=%s" % (k, v))
PY
)"
OK_ALL=yes
while IFS= read -r line; do
  case "$line" in
    DRILL_INTEGRITY=*|DRILL_RESTORED_TEST_ONLY=*|DRILL_USERS_MATCH=*|DRILL_DOCS=*|DRILL_DOCS_COMPARED=*|DRILL_DOCS_MISMATCH=*|DRILL_DOCS_CHANGED_SINCE=*|DRILL_USERS_WITH_BOTH_DOCS=*)
      echo "$line"
      ;;
  esac
done <<<"$VERIFY"
case "$VERIFY" in
  *DRILL_INTEGRITY=ok*) ;;
  *) OK_ALL=no ;;
esac
case "$VERIFY" in
  *DRILL_RESTORED_TEST_ONLY=yes*) ;;
  *) OK_ALL=no ;;
esac
case "$VERIFY" in
  *DRILL_USERS_MATCH=yes*) ;;
  *) OK_ALL=no ;;
esac
case "$VERIFY" in
  *DRILL_DOCS_MISMATCH=0*) ;;
  *) OK_ALL=no ;;
esac
BOTH="$(printf '%s\n' "$VERIFY" | sed -n 's/^DRILL_USERS_WITH_BOTH_DOCS=//p' | head -n 1)"
case "$BOTH" in
  ''|*[!0-9]*) OK_ALL=no ;;
  *) if [ "$BOTH" -lt 1 ]; then OK_ALL=no; fi ;;
esac
if [ "$OK_ALL" != "yes" ]; then
  die "只读核对没有通过（见上面的 DRILL_ 输出）。"
fi

# ---------- 13. 结果（清理由 EXIT trap 做） ----------
RESULT=PASS
