#!/usr/bin/env bash
# 05-nginx-probe.sh —— 批次 B：把探针位置块挂进 certbot 管理的 443 server 块（Phase 6，06-07，D-02、D-13）
#
# 前提：已上传并核对过 /tmp/usj-probe-upload/server/nginx/ 下的 usj-probe-locations.conf 和 anchor-block.awk，
#   PocketBase 已经在 127.0.0.1:8090 运行（04-start-pocketbase.sh）。
# 会改什么（需要所有者批准，D-04）：
#   - 只在 certbot 管理的 443 server 块里、锚点行（`server_name … # managed by Certbot`）之后追加一行
#     `include snippets/usj-probe-locations.conf; # usj-probe`；不改 certbot 管理的任何一行（listen、ssl_certificate、
#     options-ssl-nginx.conf、ssl_dhparam 都不动），也不给 443 加 http2、不启用 HTTP/3；
#   - 把片段装到 /etc/nginx/snippets/usj-probe-locations.conf（root 0644）。
# 动手之前（任何备份、安装、改写之前）先做两项检查，不通过就什么都不改、退出 1：
#   1. 锚点行恰好 1 行；
#   2. anchor-block.awk 确认锚点所在的 server 块里有 listen 443 且带 ssl（输出 ANCHOR_BLOCK=443ssl）。
# 之后：带时间戳备份站点文件（备份目录不在 nginx 加载的目录里，所以备份不会被当成站点配置）；
#   nginx -t 失败，或 certbot renew --dry-run 失败，都自动恢复备份、删除片段（原来就有的片段则恢复）并 reload；
#   用 reload，不用 restart。
# 输出：KEY=VALUE。ANCHOR_BLOCK=、NGINX_PROBE_INCLUDE=、NGINX_RELOAD=、CERTBOT_DRY_RUN=ok|fail、CERTBOT_TIMER_NEXT=。
#   站点文件名之类可能带出域名的内容，由本机的 redact.mjs 过滤。
# 失败策略：set -euo pipefail；没有 set -x；可能读标准输入的命令都带 </dev/null。
# 回滚：用备份目录里最新的站点备份覆盖站点文件，删除（或恢复）片段，nginx -t 通过后 reload。

set -euo pipefail

UP=/tmp/usj-probe-upload/server/nginx
SNIPPET_SRC="$UP/usj-probe-locations.conf"
AWK_SRC="$UP/anchor-block.awk"
SNIPPET_DST=/etc/nginx/snippets/usj-probe-locations.conf
INCLUDE_TEXT='include snippets/usj-probe-locations.conf;'
INCLUDE_LINE="    $INCLUDE_TEXT # usj-probe"
ANCHOR_RE='^[[:space:]]*server_name .*# managed by Certbot$'

for f in "$SNIPPET_SRC" "$AWK_SRC"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少上传的文件 $f，请先按批准清单上传。" >&2
    exit 1
  fi
done

SITE="$(readlink -f /etc/nginx/sites-enabled/default)"
if ! sudo -n test -f "$SITE" </dev/null; then
  echo "错误：找不到站点文件，未做任何修改。" >&2
  exit 1
fi

# ---------- 检查 1：锚点恰好 1 行（任何改动之前） ----------
N_ANCHOR="$(sudo -n grep -cE "$ANCHOR_RE" "$SITE" </dev/null || true)"
if [ "$N_ANCHOR" != "1" ]; then
  echo "错误：锚点行数不是 1（是 ${N_ANCHOR:-?}），未做任何修改。" >&2
  echo "NGINX_ANCHOR_COUNT=${N_ANCHOR:-?}"
  exit 1
fi

# ---------- 检查 2：锚点在 listen 443 ssl 的 server 块里（任何改动之前） ----------
KIND="$(sudo -n awk -f /tmp/usj-probe-upload/server/nginx/anchor-block.awk "$SITE" </dev/null)" || true
if [ "$KIND" != "ANCHOR_BLOCK=443ssl" ]; then
  echo "错误：锚点不在 listen 443 ssl 的 server 块里，未做任何修改。" >&2
  echo "${KIND:-ANCHOR_BLOCK=unknown}"
  exit 1
fi

# ---------- 备份（检查通过之后才开始改动） ----------
BACKUP_DIR=/etc/nginx/usj-backup
TS="$(date -u +%Y%m%dT%H%M%SZ)"
sudo -n install -d -m 0700 -o root -g root "$BACKUP_DIR" </dev/null
BACKUP="$BACKUP_DIR/site.$TS"
sudo -n cp -p "$SITE" "$BACKUP" </dev/null
SNIP_BACKUP=""
if sudo -n test -f "$SNIPPET_DST" </dev/null; then
  SNIP_BACKUP="$BACKUP_DIR/usj-probe-locations.conf.$TS"
  sudo -n cp -p "$SNIPPET_DST" "$SNIP_BACKUP" </dev/null
fi

rollback() {
  sudo -n cp -p "$BACKUP" "$SITE" </dev/null || true
  if [ -n "$SNIP_BACKUP" ]; then
    sudo -n cp -p "$SNIP_BACKUP" "$SNIPPET_DST" </dev/null || true
  else
    sudo -n rm -f "$SNIPPET_DST" </dev/null || true
  fi
  if sudo -n nginx -t </dev/null >/dev/null 2>&1; then
    sudo -n systemctl reload nginx </dev/null || true
  fi
}

# ---------- 安装片段，追加 include ----------
sudo -n install -d -m 0755 -o root -g root /etc/nginx/snippets </dev/null
sudo -n install -o root -g root -m 0644 "$SNIPPET_SRC" "$SNIPPET_DST" </dev/null

if sudo -n grep -qF "$INCLUDE_TEXT" "$SITE" </dev/null; then
  echo "NGINX_INCLUDE_ALREADY=yes"
else
  TMP="$(mktemp)"
  sudo -n awk -v inc="$INCLUDE_LINE" '/^[ \t]*server_name .*# managed by Certbot$/ && !done { print; print inc; done = 1; next } { print }' "$SITE" </dev/null > "$TMP"
  sudo -n install -o root -g root -m 0644 "$TMP" "$SITE" </dev/null
  rm -f "$TMP"
fi

N_INC="$(sudo -n grep -cF "$INCLUDE_TEXT" "$SITE" </dev/null || true)"
if [ "$N_INC" != "1" ]; then
  echo "错误：include 行数不是 1（是 ${N_INC:-?}），已恢复备份。" >&2
  rollback
  exit 1
fi

# ---------- nginx -t，失败就恢复 ----------
if ! sudo -n nginx -t </dev/null >/dev/null 2>&1; then
  echo "错误：nginx -t 没有通过，已恢复备份。" >&2
  sudo -n nginx -t </dev/null 2>&1 | tail -n 10 >&2 || true
  rollback
  echo "NGINX_TEST=fail"
  exit 1
fi
echo "NGINX_TEST=ok"

if ! sudo -n systemctl reload nginx </dev/null; then
  echo "错误：reload 失败，已恢复备份。" >&2
  rollback
  exit 1
fi
echo "NGINX_RELOAD=done"

# ---------- certbot renew --dry-run，失败就恢复 ----------
LOG="$(sudo -n mktemp </dev/null)"
if sudo -n certbot renew --dry-run --no-random-sleep-on-renew </dev/null 2>&1 | sudo -n tee "$LOG" >/dev/null; then
  echo "CERTBOT_DRY_RUN=ok"
  sudo -n rm -f "$LOG" </dev/null || true
else
  echo "CERTBOT_DRY_RUN=fail"
  sudo -n tail -n 20 "$LOG" </dev/null || true
  sudo -n rm -f "$LOG" </dev/null || true
  rollback
  echo "错误：certbot renew --dry-run 没有通过，已恢复备份并 reload。" >&2
  exit 1
fi

echo "ANCHOR_BLOCK=443ssl"
echo "NGINX_PROBE_INCLUDE=present"
NEXT="$(systemctl list-timers certbot.timer --no-legend </dev/null 2>/dev/null | head -n 1 | awk '{print $1" "$2" "$3}' || true)"
echo "CERTBOT_TIMER_NEXT=${NEXT:-n/a}"
