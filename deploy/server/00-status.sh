#!/usr/bin/env bash
# 00-status.sh —— 只读状态报告（Phase 13，13-06，D-11；由 Phase 6 的同名脚本改来，键换成应用站点需要的）
#
# 用途：报告服务器现状，供 13-09 的批准说明、13-10/13-11 的执行前后核对、13-12 的重启验证和 13-13 恢复演练的前置检查使用。
# 会改什么：什么都不改。只读命令；需要 root 才能读的项用 sudo -n，只做读取（nginx -t、grep、find、stat、
#           以只读方式打开 sqlite）。不下载、不写文件、不装包、不启动或停止任何服务。
# 运行方式：经标准输入运行，从不存到服务器（所以不读上传目录，也不核对 SHA256SUMS）：
#   ssh -o BatchMode=yes <别名> 'bash -s' < deploy/server/00-status.sh 2>&1 | node tools/privacy/redact.mjs
#   因为脚本经标准输入读入，脚本里每个可能读标准输入的命令都显式带 </dev/null，
#   内嵌的 python 用 heredoc，否则它们会吞掉脚本剩下的部分。
# 输出：逐行 KEY=VALUE；取不到的值写 absent、n/a 或 skipped；最后一行固定是 STATUS_DONE=1，
#       没看到这一行就说明脚本没有跑到结尾。只输出计数、布尔、数字、版本号和固定词，不输出任何字段内容、
#       邮箱、口令、令牌、钥匙。域名和 IP 不写在脚本里；个别值如果带出它们，由 redact.mjs 过滤。
#       键：系统和内存（SUDO_NOPASSWD、OS、UPTIME_S、MEM_*、SWAP_*）、nginx 和 certbot（NGINX_*、CERTBOT_*、LOGROTATE_USJ）、
#       PocketBase（PB_*，含开机自恢复 PB_SERVICE_ENABLED 和环境文件 PB_ENV_*）、库（DB_*，含恢复演练前置检查用的
#       DB_USERS_NONTEST 和 DB_DOCS_NONTEST，以及两步验证开关 DB_SU_OTP、DB_SU_MFA 和设置是否加密 DB_SETTINGS_ENCRYPTED）、
#       站点（SITE_*）、演练和上传目录（DRILL_*、UPLOAD_DIRS）。
# 失败策略：set -euo pipefail；每个探测命令自己兜底（|| true），一项取不到不影响其余项。
# 回滚：不需要（只读）。

set -euo pipefail

kv() { printf '%s=%s\n' "$1" "$2"; }

# ---------- sudo ----------
SUDO_OK=no
if sudo -n true </dev/null >/dev/null 2>&1; then SUDO_OK=yes; fi
kv SUDO_NOPASSWD "$SUDO_OK"

# 需要 root 的项：sudo 不可用时返回失败，调用处写 skipped
root_run() {
  if [ "$SUDO_OK" = yes ]; then sudo -n "$@" </dev/null; else return 1; fi
}

# ---------- 系统 ----------
OS_NAME=$( (. /etc/os-release </dev/null && printf '%s' "${PRETTY_NAME:-absent}") 2>/dev/null || printf 'absent')
kv OS "$OS_NAME"
kv UPTIME_S "$(awk '{print int($1)}' /proc/uptime </dev/null 2>/dev/null || echo n/a)"

# ---------- 内存、swap ----------
FREE_OUT=$(free -m </dev/null 2>/dev/null || true)
kv MEM_TOTAL_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Mem:/{print $2; f=1} END{if(!f) print "n/a"}')"
kv MEM_AVAILABLE_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Mem:/{print $7; f=1} END{if(!f) print "n/a"}')"
kv SWAP_TOTAL_MB "$(printf '%s\n' "$FREE_OUT" | awk '/^Swap:/{print $2; f=1} END{if(!f) print "n/a"}')"
SWAP_LIST=$(swapon --show=NAME --noheadings </dev/null 2>/dev/null || true)
if printf '%s\n' "$SWAP_LIST" | grep -qx '/swapfile'; then kv SWAPFILE_ACTIVE yes; else kv SWAPFILE_ACTIVE no; fi
if grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab </dev/null 2>/dev/null; then kv SWAP_FSTAB present; else kv SWAP_FSTAB absent; fi

# ---------- nginx 和 certbot ----------
NGINX_ACT=$(systemctl is-active nginx </dev/null 2>/dev/null || true)
kv NGINX_ACTIVE "${NGINX_ACT:-absent}"
NGINX_ENA=$(systemctl is-enabled nginx </dev/null 2>/dev/null || true)
kv NGINX_ENABLED "${NGINX_ENA:-absent}"
CERTBOT_ACT=$(systemctl is-active certbot.timer </dev/null 2>/dev/null || true)
kv CERTBOT_TIMER "${CERTBOT_ACT:-absent}"
CERTBOT_ENA=$(systemctl is-enabled certbot.timer </dev/null 2>/dev/null || true)
kv CERTBOT_TIMER_ENABLED "${CERTBOT_ENA:-absent}"

if [ "$SUDO_OK" = yes ]; then
  if root_run nginx -t >/dev/null 2>&1; then kv NGINX_TEST ok; else kv NGINX_TEST fail; fi
  if root_run grep -qE '^[[:space:]]*include[[:space:]]+/etc/nginx/conf\.d/\*\.conf;' /etc/nginx/nginx.conf 2>/dev/null; then
    kv NGINX_CONFD_INCLUDED yes
  else
    kv NGINX_CONFD_INCLUDED no
  fi
else
  kv NGINX_TEST skipped
  kv NGINX_CONFD_INCLUDED skipped
fi

SITE_PATH=$(readlink -f /etc/nginx/sites-enabled/default </dev/null 2>/dev/null || true)
if [ -n "$SITE_PATH" ] && root_run test -f "$SITE_PATH" 2>/dev/null; then
  ANCHOR=$(root_run grep -cE '^[[:space:]]*server_name .*# managed by Certbot$' "$SITE_PATH" 2>/dev/null || true)
  kv NGINX_ANCHOR_COUNT "${ANCHOR:-0}"
  # 证书块里 server 层（花括号深度 1）有没有 add_header，只报有无
  ADD_HEADER=$(root_run awk '{ line = $0; sub(/#.*/, "", line); if (line ~ /^[[:space:]]*add_header[[:space:]]/ && depth == 1) found = 1; n = gsub(/\{/, "{", line); m = gsub(/\}/, "}", line); depth += n - m } END { print (found ? "yes" : "no") }' "$SITE_PATH" 2>/dev/null || true)
  kv NGINX_SERVER_ADD_HEADER "${ADD_HEADER:-n/a}"
  if root_run grep -qF 'include snippets/usj-probe-locations.conf;' "$SITE_PATH" 2>/dev/null; then
    kv NGINX_PROBE_INCLUDE present
  else
    kv NGINX_PROBE_INCLUDE absent
  fi
  if root_run grep -qF 'include snippets/usj-app.conf;' "$SITE_PATH" 2>/dev/null; then
    kv NGINX_APP_INCLUDE present
  else
    kv NGINX_APP_INCLUDE absent
  fi
else
  kv NGINX_ANCHOR_COUNT n/a
  kv NGINX_SERVER_ADD_HEADER n/a
  kv NGINX_PROBE_INCLUDE n/a
  kv NGINX_APP_INCLUDE n/a
fi
if [ -f /etc/nginx/conf.d/usj-log-format.conf ]; then kv NGINX_LOG_FORMAT present; else kv NGINX_LOG_FORMAT absent; fi
if [ -f /etc/logrotate.d/usj-nginx ]; then kv LOGROTATE_USJ present; else kv LOGROTATE_USJ absent; fi

# ---------- PocketBase 用户、程序 ----------
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
else
  kv PB_HEALTH n/a
fi

LISTEN=$(ss -ltnH </dev/null 2>/dev/null || true)
PORT_LINES=$(printf '%s\n' "$LISTEN" | awk '$4 ~ /:8090$/ {print $4}')
if [ -z "$PORT_LINES" ]; then
  kv PB_LISTEN_LOOPBACK_ONLY n/a
elif [ -z "$(printf '%s\n' "$PORT_LINES" | grep -vx '127.0.0.1:8090' || true)" ]; then
  kv PB_LISTEN_LOOPBACK_ONLY yes
else
  kv PB_LISTEN_LOOPBACK_ONLY no
fi

# ---------- 环境文件（只报有无、权限、钥匙长度是否 32、站点地址是否设置，不输出值） ----------
if [ "$SUDO_OK" != yes ]; then
  kv PB_ENV_FILE skipped
  kv PB_ENV_MODE skipped
  kv PB_KEY_LEN_OK skipped
  kv PB_ORIGIN_SET skipped
elif root_run test -f /etc/usj/pocketbase.env 2>/dev/null; then
  kv PB_ENV_FILE present
  kv PB_ENV_MODE "$(root_run stat -c '%U:%G %a' /etc/usj/pocketbase.env 2>/dev/null || echo n/a)"
  ENV_INFO=$(root_run awk -F= '
    $1 == "PB_ENCRYPTION_KEY" { n++; kl = length(substr($0, index($0, "=") + 1)) }
    $1 == "USJ_ORIGIN" { m++; o = substr($0, index($0, "=") + 1) }
    END { print n + 0, kl + 0, m + 0, (o ~ /^https:\/\/./ ? "ok" : "bad") }' /etc/usj/pocketbase.env 2>/dev/null || true)
  if [ "$ENV_INFO" = "1 32 1 ok" ]; then
    kv PB_KEY_LEN_OK yes
    kv PB_ORIGIN_SET yes
  else
    case "$ENV_INFO" in
      "1 32 "*) kv PB_KEY_LEN_OK yes ;;
      *) kv PB_KEY_LEN_OK no ;;
    esac
    case "$ENV_INFO" in
      *" 1 ok") kv PB_ORIGIN_SET yes ;;
      *) kv PB_ORIGIN_SET no ;;
    esac
  fi
else
  kv PB_ENV_FILE absent
  kv PB_ENV_MODE n/a
  kv PB_KEY_LEN_OK n/a
  kv PB_ORIGIN_SET n/a
fi

# ---------- 迁移、钩子、工具 ----------
if [ "$SUDO_OK" = yes ]; then
  APP_MIG=0
  for m in 1794096000_users_lockdown.js 1794096100_journey_docs.js 1794096150_retire_probe.js 1794096200_server_settings.js; do
    if root_run test -f "/var/lib/pocketbase/pb_migrations/$m" 2>/dev/null; then APP_MIG=$((APP_MIG + 1)); fi
  done
  kv PB_MIGRATIONS_APP "$APP_MIG"
  PROBE_MIG=$( { root_run find /var/lib/pocketbase/pb_migrations -maxdepth 1 -type f -name '*_probe_*' 2>/dev/null || true; } | wc -l | tr -dc '0-9')
  kv PB_MIGRATIONS_PROBE "${PROBE_MIG:-0}"
  HOOK_COUNT=$( { root_run find /var/lib/pocketbase/pb_hooks -maxdepth 1 -type f -name '*.pb.js' 2>/dev/null || true; } | wc -l | tr -dc '0-9')
  kv PB_HOOKS "${HOOK_COUNT:-0}"
  if root_run test -d /var/lib/pocketbase-drill 2>/dev/null; then kv DRILL_DIR present; else kv DRILL_DIR absent; fi
else
  kv PB_MIGRATIONS_APP skipped
  kv PB_MIGRATIONS_PROBE skipped
  kv PB_HOOKS skipped
  kv DRILL_DIR skipped
fi
if [ -x /usr/local/sbin/pb-admin.sh ]; then kv PB_ADMIN_TOOL present; else kv PB_ADMIN_TOOL absent; fi
if [ -x /usr/local/sbin/usj-restore-drill ]; then kv DRILL_TOOL present; else kv DRILL_TOOL absent; fi
DRILL_ACT=$(systemctl is-active usj-drill.service </dev/null 2>/dev/null || true)
kv DRILL_UNIT "${DRILL_ACT:-absent}"

RSS_KB=$(ps -o rss= -C pocketbase </dev/null 2>/dev/null | awk '{s+=$1} END{print s+0}' || true)
if [ "$PB_ACT" = active ]; then
  kv PB_RSS_MB "$(( ${RSS_KB:-0} / 1024 ))"
else
  kv PB_RSS_MB n/a
fi

# ---------- 站点 ----------
if [ -f /var/www/usj/site/sw.js ]; then
  SITE_VER=$(grep -oE "const V = '[0-9a-f]{12}'" /var/www/usj/site/sw.js </dev/null 2>/dev/null | grep -oE '[0-9a-f]{12}' | head -n 1 || true)
  kv SITE_VERSION "${SITE_VER:-unknown}"
else
  kv SITE_VERSION absent
fi
SITE_FILES=$( { find -L /var/www/usj/site -type f </dev/null 2>/dev/null || true; } | wc -l | tr -dc '0-9')
kv SITE_FILES "${SITE_FILES:-0}"
if [ -d /var/www/usj/probe ]; then kv PROBE_PAGE_DIR present; else kv PROBE_PAGE_DIR absent; fi
UPLOADS=$( { find /tmp -maxdepth 1 -type d -name 'usj-deploy.*' </dev/null 2>/dev/null || true; } | wc -l | tr -dc '0-9')
kv UPLOAD_DIRS "${UPLOADS:-0}"

# ---------- 数据库（只读打开，只输出计数、布尔和固定词） ----------
if [ "$SUDO_OK" != yes ]; then
  kv DB skipped
elif ! root_run test -f /var/lib/pocketbase/pb_data/data.db 2>/dev/null; then
  kv DB absent
else
  sudo -n python3 -I - <<'PY' 2>/dev/null || kv DB unreadable
import json
import re
import sqlite3
import sys

DB = "/var/lib/pocketbase/pb_data/data.db"
TEST_EMAIL = re.compile(r"^test-[a-z0-9-]+@example\.com$")


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

out("DB", "present")
out("DB_COLLECTIONS_PROBE", flag("probe_results" in names and "probe_pings" in names))


def count(table):
    if table not in names and table != "_superusers":
        return "n/a"
    try:
        return con.execute('select count(*) from "%s"' % table).fetchone()[0]
    except Exception:
        return "n/a"


out("DB_SUPERUSERS_COUNT", count("_superusers"))
out("DB_USERS_COUNT", count("users"))
out("DB_DOCS_COUNT", count("journey_docs"))

# 不符合测试账号约定的账号和文档个数（恢复演练的前置检查；只数个数）
try:
    if "users" in names:
        emails = {r[0]: (r[1] or "") for r in con.execute("select id, email from users")}
        out("DB_USERS_NONTEST", sum(1 for e in emails.values() if not TEST_EMAIL.match(e)))
        if "journey_docs" in names:
            owners = [r[0] for r in con.execute("select owner from journey_docs")]
            out("DB_DOCS_NONTEST", sum(1 for o in owners if not TEST_EMAIL.match(emails.get(o, ""))))
        else:
            out("DB_DOCS_NONTEST", 0)
    else:
        out("DB_USERS_NONTEST", 0)
        out("DB_DOCS_NONTEST", 0)
except Exception:
    out("DB_USERS_NONTEST", "n/a")
    out("DB_DOCS_NONTEST", "n/a")

# 超级用户的两步验证开关（_collections 里 _superusers 的 options）
otp = mfa = None
try:
    row = con.execute("select options from _collections where name = '_superusers'").fetchone()
    if row is not None:
        opts = json.loads(row[0])
        otp = bool(opts.get("otp", {}).get("enabled"))
        mfa = bool(opts.get("mfa", {}).get("enabled"))
except Exception:
    otp = mfa = None
out("DB_SU_OTP", "n/a" if otp is None else ("on" if otp else "off"))
out("DB_SU_MFA", "n/a" if mfa is None else ("on" if mfa else "off"))

# 设置在库里是不是密文（不是合法 JSON 就是密文）
try:
    row = con.execute("select value from _params where id = 'settings'").fetchone()
    if row is None:
        out("DB_SETTINGS_ENCRYPTED", "n/a")
    else:
        value = row[0]
        try:
            text = value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)
            json.loads(text)
            out("DB_SETTINGS_ENCRYPTED", "no")
        except Exception:
            out("DB_SETTINGS_ENCRYPTED", "yes")
except Exception:
    out("DB_SETTINGS_ENCRYPTED", "n/a")
PY
fi

kv STATUS_DONE 1
