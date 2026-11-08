#!/usr/bin/env bash
# 00-status.sh —— 只读状态报告（Phase 6，06-06 Task 1，D-04a）
#
# 用途：报告服务器现状，并确认 admin 账号能不用密码 sudo（D-04a）、nginx 锚点唯一、8090 空闲。
# 会改什么：什么都不改。只读命令；需要 root 才能读的项用 sudo -n，只做读取（nginx -t、grep、find、
#           以只读方式打开 sqlite）。不下载、不写文件、不装包、不启动或停止任何服务。
# 运行方式：经标准输入运行，从不存到服务器：
#   ssh -o BatchMode=yes usj 'bash -s' < tools/probe/server/00-status.sh 2>&1 | node tools/privacy/redact.mjs
#   因为脚本经标准输入读入，脚本里每个可能读标准输入的命令都显式带 </dev/null，
#   内嵌的 python 用 heredoc，否则它们会吞掉脚本剩下的部分（T-06-15）。
# 输出：逐行 KEY=VALUE；取不到的值写 absent、n/a 或 skipped；最后一行固定是 STATUS_DONE=1，
#       没看到这一行就说明脚本没有跑到结尾。只输出计数、布尔、数字和固定词，不输出任何字段内容、
#       口令、令牌。域名和 IP 不写在脚本里；个别值（例如站点文件名）如果带出它们，由 redact.mjs 过滤。
# 失败策略：set -euo pipefail；每个探测命令自己兜底（|| true），一项取不到不影响其余项。
# 回滚：不需要（只读）。

set -euo pipefail

kv() { printf '%s=%s\n' "$1" "$2"; }

# ---------- sudo（D-04a） ----------
SUDO_OK=no
if sudo -n true </dev/null >/dev/null 2>&1; then SUDO_OK=yes; fi
kv SUDO_NOPASSWD "$SUDO_OK"

# 需要 root 的项：sudo 不可用时写 skipped
root_run() {
  if [ "$SUDO_OK" = yes ]; then sudo -n "$@" </dev/null; else return 1; fi
}

# ---------- 系统 ----------
OS_NAME=$( (. /etc/os-release </dev/null && printf '%s' "${PRETTY_NAME:-absent}") 2>/dev/null || printf 'absent')
kv OS "$OS_NAME"
kv ARCH "$(uname -m </dev/null)"

# ---------- 内存、swap、磁盘 ----------
FREE_OUT=$(free -m </dev/null 2>/dev/null || true)
kv MEM_TOTAL_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Mem:/{print $2; f=1} END{if(!f) print "n/a"}')"
kv MEM_AVAILABLE_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Mem:/{print $7; f=1} END{if(!f) print "n/a"}')"
kv SWAP_TOTAL_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Swap:/{print $2; f=1} END{if(!f) print "n/a"}')"
SWAP_LIST=$(swapon --show=NAME --noheadings </dev/null 2>/dev/null || true)
if printf '%s\n' "$SWAP_LIST" | grep -qx '/swapfile'; then kv SWAPFILE_ACTIVE yes; else kv SWAPFILE_ACTIVE no; fi
DISK_AVAIL=$(df -BG --output=avail / </dev/null 2>/dev/null | tail -n 1 | tr -dc '0-9' || true)
kv DISK_ROOT_AVAIL_GB "${DISK_AVAIL:-n/a}"

# ---------- 时间同步 ----------
NTP=$(timedatectl show -p NTPSynchronized --value </dev/null 2>/dev/null || true)
kv NTP_SYNC "${NTP:-n/a}"

# ---------- nginx 和 certbot ----------
NGINX_ACT=$(systemctl is-active nginx </dev/null 2>/dev/null || true)
kv NGINX_ACTIVE "${NGINX_ACT:-absent}"
CERTBOT_ACT=$(systemctl is-active certbot.timer </dev/null 2>/dev/null || true)
kv CERTBOT_TIMER "${CERTBOT_ACT:-absent}"

if [ "$SUDO_OK" = yes ]; then
  if root_run nginx -t >/dev/null 2>&1; then kv NGINX_TEST ok; else kv NGINX_TEST fail; fi
else
  kv NGINX_TEST skipped
fi

SITE_PATH=$(readlink -f /etc/nginx/sites-enabled/default </dev/null 2>/dev/null || true)
if [ -n "$SITE_PATH" ] && root_run test -f "$SITE_PATH" 2>/dev/null; then
  kv NGINX_SITE "$(basename "$SITE_PATH")"
  ANCHOR=$(root_run grep -cE '^[[:space:]]*server_name .*# managed by Certbot$' "$SITE_PATH" 2>/dev/null || true)
  kv NGINX_ANCHOR_COUNT "${ANCHOR:-0}"
  if root_run grep -qF 'include snippets/usj-probe-locations.conf;' "$SITE_PATH" 2>/dev/null; then
    kv NGINX_PROBE_INCLUDE present
  else
    kv NGINX_PROBE_INCLUDE absent
  fi
else
  if [ "$SUDO_OK" = yes ]; then kv NGINX_SITE absent; else kv NGINX_SITE skipped; fi
  kv NGINX_ANCHOR_COUNT n/a
  kv NGINX_PROBE_INCLUDE n/a
fi

# ---------- 8090 端口 ----------
LISTEN=$(ss -ltnH </dev/null 2>/dev/null || true)
PORT_LINES=$(printf '%s\n' "$LISTEN" | awk '$4 ~ /:8090$/ {print $4}')
if [ -z "$PORT_LINES" ]; then
  kv PORT_8090 free
elif [ -z "$(printf '%s\n' "$PORT_LINES" | grep -vx '127.0.0.1:8090' || true)" ]; then
  kv PORT_8090 127.0.0.1
else
  kv PORT_8090 other
fi

# ---------- PocketBase 用户、程序、迁移、探针页 ----------
if id pocketbase </dev/null >/dev/null 2>&1; then PB_USER_STATE=present; else PB_USER_STATE=absent; fi
kv PB_USER "$PB_USER_STATE"

if [ -x /opt/pocketbase/pocketbase ]; then
  if [ "$SUDO_OK" = yes ] && [ "$PB_USER_STATE" = present ]; then
    PB_VER=$(root_run -u pocketbase /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data --version 2>/dev/null | head -n 1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)
    kv PB_BINARY_VERSION "${PB_VER:-unknown}"
  else
    kv PB_BINARY_VERSION skipped
  fi
else
  kv PB_BINARY_VERSION absent
fi

if [ "$SUDO_OK" = yes ]; then
  MIG_COUNT=$( { root_run find /var/lib/pocketbase/pb_migrations -maxdepth 1 -type f -name '*_probe_*' 2>/dev/null || true; } | wc -l | tr -dc '0-9')
  kv PB_MIGRATIONS "${MIG_COUNT:-0}"
else
  kv PB_MIGRATIONS skipped
fi
if [ -f /var/www/usj/probe/config.js ]; then kv PROBE_CONFIG_JS present; else kv PROBE_CONFIG_JS absent; fi
PAGE_COUNT=$( { find /var/www/usj/probe -type f </dev/null 2>/dev/null || true; } | wc -l | tr -dc '0-9')
kv PROBE_PAGE_FILES "${PAGE_COUNT:-0}"

# ---------- PocketBase 服务 ----------
if systemctl cat pocketbase.service </dev/null >/dev/null 2>&1; then
  PB_ACT=$(systemctl is-active pocketbase.service </dev/null 2>/dev/null || true)
  PB_ENA=$(systemctl is-enabled pocketbase.service </dev/null 2>/dev/null || true)
  kv PB_SERVICE_ACTIVE "${PB_ACT:-unknown}"
  kv PB_SERVICE_ENABLED "${PB_ENA:-unknown}"
else
  PB_ACT=absent
  kv PB_SERVICE_ACTIVE absent
  kv PB_SERVICE_ENABLED absent
fi

if [ "$PB_ACT" = active ]; then
  if command -v curl </dev/null >/dev/null 2>&1 && curl -fsS -m 5 http://127.0.0.1:8090/api/health </dev/null >/dev/null 2>&1; then
    kv PB_HEALTH ok
  else
    kv PB_HEALTH fail
  fi
  MEM_BYTES=$(systemctl show -p MemoryCurrent --value pocketbase.service </dev/null 2>/dev/null || true)
  case "$MEM_BYTES" in
    ''|*[!0-9]*) kv PB_MEMORY_CURRENT_MB n/a ;;
    *) if [ "${#MEM_BYTES}" -le 15 ]; then kv PB_MEMORY_CURRENT_MB "$((MEM_BYTES / 1048576))"; else kv PB_MEMORY_CURRENT_MB n/a; fi ;;
  esac
  RSS_KB=$(ps -o rss= -C pocketbase </dev/null 2>/dev/null | awk '{s+=$1} END{print s+0}' || true)
  kv PB_RSS_MB "$(( ${RSS_KB:-0} / 1024 ))"
else
  kv PB_HEALTH n/a
  kv PB_MEMORY_CURRENT_MB n/a
  kv PB_RSS_MB n/a
fi

# ---------- 数据库（只读打开，只输出计数、布尔和数字） ----------
if [ "$SUDO_OK" != yes ]; then
  kv DB skipped
elif ! root_run test -f /var/lib/pocketbase/pb_data/data.db 2>/dev/null; then
  kv DB absent
else
  sudo -n python3 -I - <<'PY' 2>/dev/null || kv DB unreadable
import json
import sqlite3
import sys

DB = "/var/lib/pocketbase/pb_data/data.db"


def out(key, value):
    print("%s=%s" % (key, value))


def flag(v):
    if v is True:
        return "yes"
    if v is False:
        return "no"
    return "n/a"


try:
    con = sqlite3.connect("file:" + DB + "?mode=ro", uri=True, timeout=3)
    names = {r[0] for r in con.execute("select name from _collections")}
except Exception:
    print("DB=unreadable")
    sys.exit(0)

out("DB_COLLECTIONS_PROBE", flag("probe_results" in names and "probe_pings" in names))

try:
    row = con.execute("select createRule, updateRule, deleteRule from _collections where name = 'users'").fetchone()
    out("DB_USERS_RULES_LOCKED", "n/a" if row is None else flag(all(x is None for x in row)))
except Exception:
    out("DB_USERS_RULES_LOCKED", "n/a")

settings = None
try:
    row = con.execute("select value from _params where key = 'settings'").fetchone()
    if row is not None:
        settings = json.loads(row[0])
except Exception:
    settings = None


def pick(path):
    cur = settings
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


max_days = pick(["logs", "maxDays"])
out("DB_SETTINGS_LOGS_MAXDAYS", max_days if isinstance(max_days, int) and not isinstance(max_days, bool) else "n/a")
out("DB_SETTINGS_LOGIP", flag(pick(["logs", "logIP"])))
headers = pick(["trustedProxy", "headers"])
out("DB_SETTINGS_TRUSTED_PROXY_XREALIP", flag("X-Real-IP" in headers) if isinstance(headers, list) else "n/a")
out("DB_SETTINGS_RATELIMITS", flag(pick(["rateLimits", "enabled"])))


def count(table):
    if table not in names and table != "_superusers":
        return "n/a"
    try:
        return con.execute('select count(*) from "%s"' % table).fetchone()[0]
    except Exception:
        return "n/a"


out("DB_USERS_COUNT", count("users"))
out("DB_SUPERUSERS_COUNT", count("_superusers"))
out("DB_PROBE_RESULTS_COUNT", count("probe_results"))
out("DB_PROBE_PINGS_COUNT", count("probe_pings"))
PY
fi

kv STATUS_DONE 1
