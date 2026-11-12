#!/usr/bin/env bash
# 05-nginx-app.sh —— 把应用的 nginx 配置挂进 certbot 管理的 443 server 块，换掉探针的 include（Phase 13，13-07，D-01、D-03、D-10、D-11、WR-09、SEC-02）
#
# 用法：05-nginx-app.sh /tmp/usj-deploy.<随机>
#   第一个参数是上传目录（mktemp -d 建的 0700 目录，属于当前用户，里面有 SHA256SUMS）；本脚本读
#   server/nginx/ 下的 usj-app.conf、usj-headers-common.conf、usj-headers-proxy.conf、usj-log-format.conf、
#   anchor-block.awk，以及 server/logrotate/usj-nginx。
# 前提：06-install-site.sh 已经跑过（/etc/nginx/snippets/usj-csp.conf 和 /var/www/usj/site/index.html 都在），
#   PocketBase 已经在 127.0.0.1:8090 运行（04）。
# 动手之前先只读确认（任何一项不满足就退出 1，什么都不改）：
#   - 上传目录格式、属主、权限，上面 6 个文件各在 SHA256SUMS 里恰好一行并通过 sha256sum -c（IN-09）；
#   - usj-csp.conf 和站点首页都在（否则提示先运行 06）；
#   - /etc/nginx/nginx.conf 的 http 块 include 了 conf.d/*.conf（log_format 要靠它装进 http 层）；
#   - 锚点行（`server_name … # managed by Certbot`）恰好 1 行，anchor-block.awk 确认它在 listen 443 ssl 的 server 块里；
#   - www 跳转的两项判断：锚点行的 server_name 里同时有裸域名和 www.<裸域名>（证书覆盖 www），并且服务器上
#     getent ahosts www.<裸域名> 有结果；两项都满足才跳转，否则不跳转（输出 WWW_REDIRECT=skipped，不输出任何主机名）。
# 会改什么（需要所有者批准）：
#   - 先备份到 /etc/nginx/usj-backup/<UTC 时间戳>/（站点文件、已存在的 usj-* 片段、探针片段、日志格式、logrotate 文件，
#     并记下哪些原本不存在），然后才挂 trap rollback ERR；
#   - install -d -o root -g adm -m 0750 /var/log/usj；装日志格式到 /etc/nginx/conf.d/，三个片段到 /etc/nginx/snippets/，
#     logrotate 配置到 /etc/logrotate.d/usj-nginx（都是 root 0644）；生成 /etc/nginx/snippets/usj-www-redirect.conf；
#   - 站点文件：删掉探针的 include 行，保证锚点后恰好一行 `    include snippets/usj-app.conf; # usj-app`；
#     先写到站点文件所在目录的临时文件，核对应用 include 恰好 1 行、探针 include 0 行，再 mv 替换；不改 certbot 管理的任何一行；
#   - nginx -t，systemctl reload nginx，certbot renew --dry-run --no-random-sleep-on-renew，logrotate -d 干跑；
#   - 全部成功之后才解除 trap，再删除 /etc/nginx/snippets/usj-probe-locations.conf（探针片段在 certbot 干跑通过之前一直留着，回滚用得上）。
#   重跑时片段和站点文件都已是目标内容，只做 nginx -t 并输出 NGINX_APP=already（不 reload、不跑 certbot 干跑）。
# 输出：KEY=VALUE。ANCHOR_BLOCK=443ssl、NGINX_APP_INCLUDE=1、NGINX_PROBE_INCLUDE=0、NGINX_TEST=ok、NGINX_RELOAD=done|skipped、
#   CERTBOT_DRY_RUN=ok|skipped、LOGROTATE_DRYRUN=ok|skipped、PROBE_SNIPPET=removed|absent、WWW_REDIRECT=on|skipped、NGINX_APP=done|already。
# 失败策略：set -euo pipefail；没有 set -x；不输出主机名；可能读标准输入的命令都带 </dev/null。
#   任何一步失败（含 nginx -t、reload、certbot 干跑、logrotate 干跑）都恢复备份、删掉原本不存在的新文件、nginx -t 通过才 reload，退出 1。
# 回滚：备份目录 /etc/nginx/usj-backup/<时间戳>/ 里有被改动文件的原样副本；手工回滚就是把它们拷回去，删掉原本不存在的文件，
#   nginx -t 通过后 systemctl reload nginx。

set -euo pipefail
set -E

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
verify_uploads server/nginx/usj-app.conf server/nginx/usj-headers-common.conf server/nginx/usj-headers-proxy.conf server/nginx/usj-log-format.conf server/nginx/anchor-block.awk server/logrotate/usj-nginx

AWK_SRC="$UP/server/nginx/anchor-block.awk"
ANCHOR_RE='^[[:space:]]*server_name .*# managed by Certbot$'
APP_INCLUDE_TEXT='include snippets/usj-app.conf;'
APP_INCLUDE_LINE="    $APP_INCLUDE_TEXT # usj-app"
PROBE_INCLUDE_TEXT='include snippets/usj-probe-locations.conf;'
PROBE_SNIP=/etc/nginx/snippets/usj-probe-locations.conf
WWW_SNIP=/etc/nginx/snippets/usj-www-redirect.conf
CSP_SNIP=/etc/nginx/snippets/usj-csp.conf
BACKUP_ROOT=/etc/nginx/usj-backup

# 上传文件 → 目标文件（都是 root 0644）
SRC_REL=(server/nginx/usj-log-format.conf server/nginx/usj-app.conf server/nginx/usj-headers-common.conf server/nginx/usj-headers-proxy.conf server/logrotate/usj-nginx)
DST=(/etc/nginx/conf.d/usj-log-format.conf /etc/nginx/snippets/usj-app.conf /etc/nginx/snippets/usj-headers-common.conf /etc/nginx/snippets/usj-headers-proxy.conf /etc/logrotate.d/usj-nginx)

# ---------- 前置（只读） ----------
if ! sudo -n test -f "$CSP_SNIP" </dev/null || ! sudo -n test -f /var/www/usj/site/index.html </dev/null; then
  echo "错误：页面或 CSP 头文件还没装，请先运行 06-install-site.sh。" >&2
  exit 1
fi
if ! sudo -n grep -qE '^[[:space:]]*include[[:space:]]+/etc/nginx/conf\.d/\*\.conf;' /etc/nginx/nginx.conf </dev/null; then
  echo "错误：/etc/nginx/nginx.conf 没有 include conf.d/*.conf，log_format 装不进 http 层，未做任何修改。" >&2
  exit 1
fi

SITE="$(readlink -f /etc/nginx/sites-enabled/default)"
if ! sudo -n test -f "$SITE" </dev/null; then
  echo "错误：找不到站点文件，未做任何修改。" >&2
  exit 1
fi
SITE_DIR="$(dirname "$SITE")"

N_ANCHOR="$(sudo -n grep -cE "$ANCHOR_RE" "$SITE" </dev/null || true)"
if [ "$N_ANCHOR" != "1" ]; then
  echo "错误：锚点行数不是 1（是 ${N_ANCHOR:-?}），未做任何修改。" >&2
  echo "NGINX_ANCHOR_COUNT=${N_ANCHOR:-?}"
  exit 1
fi
KIND="$(sudo -n awk -f "$AWK_SRC" "$SITE" </dev/null)" || true
if [ "$KIND" != "ANCHOR_BLOCK=443ssl" ]; then
  echo "错误：锚点不在 listen 443 ssl 的 server 块里，未做任何修改。" >&2
  echo "${KIND:-ANCHOR_BLOCK=unknown}"
  exit 1
fi

# www 跳转的两项只读判断：证书覆盖 www（server_name 里同时有裸域名和 www.<裸域名>），并且服务器上 www 能解析
WWW_ON=no
SN_TOKENS="$(sudo -n grep -E "$ANCHOR_RE" "$SITE" </dev/null | sed -E 's/#.*$//; s/^[[:space:]]*server_name[[:space:]]+//; s/;//g' | tr -s '[:space:]' '\n')"
for t in $SN_TOKENS; do
  case "$t" in
    www.*)
      bare="${t#www.}"
      if [[ "$bare" =~ ^[A-Za-z0-9.-]+$ ]] && grep -qxF "$bare" <<<"$SN_TOKENS"; then
        if [ -n "$(getent ahosts "$t" </dev/null 2>/dev/null | head -n 1)" ]; then
          WWW_ON=yes
        fi
      fi
      ;;
  esac
done

LOCAL_TMP="$(mktemp -d)"
TMP_SITE=""
cleanup() {
  [ -n "${TMP_SITE:-}" ] && sudo -n rm -f "$TMP_SITE" </dev/null || true
  rm -rf "$LOCAL_TMP"
}
trap cleanup EXIT

# 目标内容先算在本机临时目录里（不动任何系统文件），用来判断“要不要改”
WWW_NEW="$LOCAL_TMP/www-redirect.conf"
if [ "$WWW_ON" = "yes" ]; then
  {
    echo '# usj-www-redirect.conf —— 由 05-nginx-app.sh 生成：证书覆盖 www 并且 www 能解析，所以 www 开头的主机名 301 到裸域名（只保留一个源）'
    echo 'if ($host ~* ^www\.(.+)$) { return 301 https://$1$request_uri; }'
  } > "$WWW_NEW"
  WWW_STATE=on
else
  {
    echo '# usj-www-redirect.conf —— 由 05-nginx-app.sh 生成：证书不覆盖 www 或 www 解析不了，所以不跳转'
  } > "$WWW_NEW"
  WWW_STATE=skipped
fi

SITE_NEW="$LOCAL_TMP/site.new"
sudo -n awk -v inc="$APP_INCLUDE_LINE" '
  /^[ \t]*include snippets\/usj-probe-locations\.conf;/ { next }
  /^[ \t]*include snippets\/usj-app\.conf;/ { next }
  /^[ \t]*server_name .*# managed by Certbot$/ && !done { print; print inc; done = 1; next }
  { print }' "$SITE" </dev/null > "$SITE_NEW"

differs() { ! sudo -n cmp -s "$1" "$2" </dev/null 2>/dev/null; }

NEED=no
for i in "${!SRC_REL[@]}"; do
  if differs "$UP/${SRC_REL[$i]}" "${DST[$i]}"; then NEED=yes; fi
done
if differs "$WWW_NEW" "$WWW_SNIP"; then NEED=yes; fi
if differs "$SITE_NEW" "$SITE"; then NEED=yes; fi
if sudo -n test -e "$PROBE_SNIP" </dev/null; then NEED=yes; fi
if ! sudo -n test -d /var/log/usj </dev/null; then NEED=yes; fi

if [ "$NEED" = "no" ]; then
  if ! sudo -n nginx -t </dev/null >/dev/null 2>&1; then
    echo "错误：nginx -t 没有通过（配置已是目标内容，没有改动任何东西）。" >&2
    echo "NGINX_TEST=fail"
    exit 1
  fi
  echo "ANCHOR_BLOCK=443ssl"
  echo "NGINX_APP_INCLUDE=1"
  echo "NGINX_PROBE_INCLUDE=0"
  echo "NGINX_TEST=ok"
  echo "NGINX_RELOAD=skipped"
  echo "CERTBOT_DRY_RUN=skipped"
  echo "LOGROTATE_DRYRUN=skipped"
  echo "PROBE_SNIPPET=absent"
  echo "WWW_REDIRECT=$WWW_STATE"
  echo "NGINX_APP=already"
  exit 0
fi

# ---------- 备份（检查通过之后才开始改动） ----------
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BK="$BACKUP_ROOT/$TS"
sudo -n install -d -m 0700 -o root -g root "$BACKUP_ROOT" "$BK" </dev/null
MANAGED=("$SITE" "${DST[@]}" "$WWW_SNIP" "$PROBE_SNIP")
ABSENT=()
for p in "${MANAGED[@]}"; do
  if sudo -n test -f "$p" </dev/null; then
    sudo -n cp -p "$p" "$BK/$(printf '%s' "$p" | tr '/' '_')" </dev/null
  else
    ABSENT+=("$p")
  fi
done

ROLLED_BACK=no
rollback() {
  trap - ERR
  if [ "$ROLLED_BACK" = "yes" ]; then return 0; fi
  ROLLED_BACK=yes
  local p saved
  for p in "${MANAGED[@]}"; do
    saved="$BK/$(printf '%s' "$p" | tr '/' '_')"
    if sudo -n test -f "$saved" </dev/null; then
      sudo -n cp -p "$saved" "$p" </dev/null || true
    else
      sudo -n rm -f "$p" </dev/null || true
    fi
  done
  if sudo -n nginx -t </dev/null >/dev/null 2>&1; then
    sudo -n systemctl reload nginx </dev/null || true
  fi
  echo "已恢复备份（$BK）。" >&2
}
trap rollback ERR

fail() {
  echo "错误：$1" >&2
  rollback
  exit 1
}

# ---------- 安装：日志目录、日志格式、片段、logrotate ----------
sudo -n install -d -o root -g adm -m 0750 /var/log/usj </dev/null
sudo -n install -d -m 0755 -o root -g root /etc/nginx/snippets </dev/null
for i in "${!SRC_REL[@]}"; do
  sudo -n install -o root -g root -m 0644 "$UP/${SRC_REL[$i]}" "${DST[$i]}" </dev/null
done
sudo -n install -o root -g root -m 0644 "$WWW_NEW" "$WWW_SNIP" </dev/null

# ---------- 站点文件：先写同目录的临时文件，核对后 mv 替换 ----------
TMP_SITE="$(sudo -n mktemp "$SITE_DIR/.usj-site.XXXXXX" </dev/null)"
sudo -n cp "$SITE_NEW" "$TMP_SITE" </dev/null
sudo -n chmod --reference="$SITE" "$TMP_SITE" </dev/null
sudo -n chown --reference="$SITE" "$TMP_SITE" </dev/null
N_APP="$(sudo -n grep -cF "$APP_INCLUDE_TEXT" "$TMP_SITE" </dev/null || true)"
N_PROBE="$(sudo -n grep -cF "$PROBE_INCLUDE_TEXT" "$TMP_SITE" </dev/null || true)"
if [ "$N_APP" != "1" ] || [ "$N_PROBE" != "0" ]; then
  fail "站点文件里应用 include 的行数不是 1（是 ${N_APP:-?}）或探针 include 的行数不是 0（是 ${N_PROBE:-?}）。"
fi
sudo -n mv -T "$TMP_SITE" "$SITE" </dev/null
TMP_SITE=""

# ---------- nginx -t、reload、certbot 干跑、logrotate 干跑：任一失败都恢复备份 ----------
if ! sudo -n nginx -t </dev/null >/dev/null 2>&1; then
  sudo -n nginx -t </dev/null 2>&1 | tail -n 10 | sed -E 's#https?://[^[:space:]/]+#<origin>#g' >&2 || true
  echo "NGINX_TEST=fail"
  fail "nginx -t 没有通过。"
fi
echo "NGINX_TEST=ok"

if ! sudo -n systemctl reload nginx </dev/null; then
  fail "systemctl reload nginx 失败。"
fi
echo "NGINX_RELOAD=done"

CB_LOG="$LOCAL_TMP/certbot.log"
if sudo -n certbot renew --dry-run --no-random-sleep-on-renew </dev/null > "$CB_LOG" 2>&1; then
  echo "CERTBOT_DRY_RUN=ok"
else
  echo "CERTBOT_DRY_RUN=fail"
  tail -n 20 "$CB_LOG" | sed -E 's#https?://[^[:space:]/]+#<origin>#g' >&2 || true
  fail "certbot renew --dry-run 没有通过。"
fi

if sudo -n logrotate -d /etc/logrotate.d/usj-nginx </dev/null > "$LOCAL_TMP/logrotate.log" 2>&1; then
  echo "LOGROTATE_DRYRUN=ok"
else
  echo "LOGROTATE_DRYRUN=fail"
  tail -n 10 "$LOCAL_TMP/logrotate.log" >&2 || true
  fail "logrotate -d 干跑没有通过。"
fi

# ---------- 全部成功：解除回滚，再删探针片段 ----------
trap - ERR
PROBE_STATE=absent
if sudo -n test -e "$PROBE_SNIP" </dev/null; then
  PROBE_STATE=removed
fi
sudo -n rm -f "$PROBE_SNIP" </dev/null

echo "ANCHOR_BLOCK=443ssl"
echo "NGINX_APP_INCLUDE=1"
echo "NGINX_PROBE_INCLUDE=0"
echo "PROBE_SNIPPET=$PROBE_STATE"
echo "WWW_REDIRECT=$WWW_STATE"
echo "NGINX_APP=done"
