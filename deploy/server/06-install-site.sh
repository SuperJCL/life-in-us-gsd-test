#!/usr/bin/env bash
# 06-install-site.sh —— 核对后把站点装进版本目录，原子切换符号链接，同时换上同一次构建的 CSP 头（Phase 13，13-07，OPS-03、SEC-02）
#
# 用法：06-install-site.sh /tmp/usj-deploy.<随机>
#   第一个参数是上传目录（mktemp -d 建的 0700 目录，属于当前用户，里面有 SHA256SUMS）。本脚本读：
#   SHA256SUMS 里所有 site/ 开头的文件、server/nginx/usj-csp.conf、BUILD_VERSION。
# 动手之前先只读确认（任何一项不满足就退出 1，什么都不改）：
#   - 上传目录格式、属主、权限；上面这些文件各在 SHA256SUMS 里恰好一行并通过 sha256sum -c；
#   - site/vendor/ 里的 SDK 再按它自己的 SHA256SUMS 核对一遍（SDK 的哈希是钉死的）；
#   - BUILD_VERSION 是 12 位十六进制；站点文件路径只含安全字符、没有 ..；
#   - /var/www/usj/site 如果存在，必须是符号链接（是真目录就退出，不覆盖）。
# 会改什么（需要所有者批准）：
#   - 装到 /var/www/usj/releases/<版本>/（目录 root 0755，文件 root 0644）；同版本目录已存在且内容逐字节一致就跳过复制；
#   - 备份当前 site 符号链接指向和 /etc/nginx/snippets/usj-csp.conf，然后挂 trap rollback ERR；
#   - ln -sfn 建 /var/www/usj/site.new，再 mv -T 原子地换成 /var/www/usj/site（页面从旧版本一步切到新版本）；
#   - 装同一次构建的 usj-csp.conf（页面里内联脚本和样式的哈希写在里面，所以页面和 CSP 必须一起换）；
#   - 站点文件里已经有应用 include（05 跑过）时 nginx -t 再 reload；还没有（第一次部署）就不动 nginx；
#   - 成功后解除 trap，只保留最近 3 个版本目录（当前的和切换前的一定保留，便于回滚）。
#   不删上传目录：批次的最后一步单独删（13-11）。
# 输出：KEY=VALUE。SITE_VERSION=<版本>、SITE_FILES=N、SITE_SWAP=done|already、CSP_CONF=installed|same、NGINX_RELOAD=done|skipped。
# 失败策略：set -euo pipefail；没有 set -x；可能读标准输入的命令都带 </dev/null；出错就恢复符号链接和 CSP 头，nginx -t 通过才 reload。
# 回滚：sudo ln -sfn releases/<旧版本> /var/www/usj/site.new && sudo mv -T /var/www/usj/site.new /var/www/usj/site，
#   把旧的 usj-csp.conf 放回 /etc/nginx/snippets/，nginx -t 通过后 systemctl reload nginx。旧版本目录一直留着（最近 3 个）。

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

# SHA256SUMS 里所有 site/ 开头的文件（路径只允许安全字符，不许 ..）
mapfile -t SITE_LIST < <(awk '{ f = $2; sub(/^\*/, "", f); if (f ~ /^site\//) print f }' "$UP/SHA256SUMS")
if [ "${#SITE_LIST[@]}" -lt 1 ]; then
  echo "错误：SHA256SUMS 里没有 site/ 开头的文件。" >&2
  exit 1
fi
for f in "${SITE_LIST[@]}"; do
  if ! [[ "$f" =~ ^site/[A-Za-z0-9._/-]+$ ]] || [[ "$f" == *..* ]]; then
    echo "错误：站点文件路径含不安全字符：$f" >&2
    exit 1
  fi
done
for need in site/index.html site/sw.js site/manifest.webmanifest site/vendor/pocketbase.iife.js site/vendor/SHA256SUMS; do
  found=no
  for f in "${SITE_LIST[@]}"; do
    if [ "$f" = "$need" ]; then found=yes; fi
  done
  if [ "$found" != "yes" ]; then
    echo "错误：SHA256SUMS 里缺少必需的站点文件 $need。" >&2
    exit 1
  fi
done

verify_uploads "${SITE_LIST[@]}" server/nginx/usj-csp.conf BUILD_VERSION
if ! (cd "$UP/site/vendor" && sha256sum -c --strict --status SHA256SUMS </dev/null); then
  echo "错误：SDK 文件与 site/vendor/SHA256SUMS 不一致，什么都没有改。" >&2
  exit 1
fi

VER="$(tr -d '[:space:]' < "$UP/BUILD_VERSION")"
if ! [[ "$VER" =~ ^[0-9a-f]{12}$ ]]; then
  echo "错误：BUILD_VERSION 不是 12 位十六进制。" >&2
  exit 1
fi

WEB_ROOT=/var/www/usj
REL_ROOT="$WEB_ROOT/releases"
REL="$REL_ROOT/$VER"
SITE_LINK="$WEB_ROOT/site"
SITE_NEW="$WEB_ROOT/site.new"
CSP_SRC="$UP/server/nginx/usj-csp.conf"
CSP_DST=/etc/nginx/snippets/usj-csp.conf
SITE_CONF="$(readlink -f /etc/nginx/sites-enabled/default 2>/dev/null || true)"

if sudo -n test -e "$SITE_LINK" </dev/null && ! sudo -n test -L "$SITE_LINK" </dev/null; then
  echo "错误：$SITE_LINK 存在但不是符号链接，不覆盖，未做任何修改。" >&2
  exit 1
fi

# ---------- 要不要改（只读） ----------
OLD_LINK="$(sudo -n readlink "$SITE_LINK" </dev/null 2>/dev/null || true)"
REL_SAME=no
if sudo -n test -d "$REL" </dev/null; then
  REL_SAME=yes
  for f in "${SITE_LIST[@]}"; do
    if ! sudo -n cmp -s "$UP/$f" "$REL/${f#site/}" </dev/null 2>/dev/null; then REL_SAME=no; fi
  done
  N_HAVE="$(sudo -n find "$REL" -type f </dev/null 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$N_HAVE" != "${#SITE_LIST[@]}" ]; then REL_SAME=no; fi
fi
CSP_SAME=no
if sudo -n cmp -s "$CSP_SRC" "$CSP_DST" </dev/null 2>/dev/null; then CSP_SAME=yes; fi
if [ "$REL_SAME" = "no" ] && [ "$OLD_LINK" = "releases/$VER" ]; then
  echo "错误：当前正在使用的版本目录内容与上传的不一致（同一版本号不该有不同内容），未做任何修改。" >&2
  exit 1
fi

LOCAL_TMP="$(mktemp -d)"
STAGE=""
cleanup() {
  [ -n "${STAGE:-}" ] && sudo -n rm -rf "$STAGE" </dev/null || true
  sudo -n rm -f "$SITE_NEW" </dev/null || true
  rm -rf "$LOCAL_TMP"
}
trap cleanup EXIT

# ---------- 装版本目录（不影响线上：还没有任何东西指向它） ----------
sudo -n install -d -o root -g root -m 0755 "$WEB_ROOT" "$REL_ROOT" /etc/nginx/snippets </dev/null
if [ "$REL_SAME" = "no" ]; then
  STAGE="$REL_ROOT/.stage.$VER"
  sudo -n rm -rf "$STAGE" </dev/null
  sudo -n install -d -o root -g root -m 0755 "$STAGE" </dev/null
  for f in "${SITE_LIST[@]}"; do
    rel="${f#site/}"
    sudo -n install -d -o root -g root -m 0755 "$STAGE/$(dirname "$rel")" </dev/null
    sudo -n install -o root -g root -m 0644 "$UP/$f" "$STAGE/$rel" </dev/null
  done
  sudo -n rm -rf "$REL" </dev/null
  sudo -n mv -T "$STAGE" "$REL" </dev/null
  STAGE=""
fi

# ---------- 备份当前状态，然后挂回滚 ----------
CSP_OLD="$LOCAL_TMP/csp.old"
CSP_ABSENT=yes
if sudo -n test -f "$CSP_DST" </dev/null; then
  sudo -n cp -p "$CSP_DST" "$CSP_OLD" </dev/null
  CSP_ABSENT=no
fi

app_included() {
  [ -n "$SITE_CONF" ] && sudo -n grep -qF 'include snippets/usj-app.conf;' "$SITE_CONF" </dev/null 2>/dev/null
}

ROLLED_BACK=no
rollback() {
  trap - ERR
  if [ "$ROLLED_BACK" = "yes" ]; then return 0; fi
  ROLLED_BACK=yes
  if [ -n "$OLD_LINK" ]; then
    sudo -n ln -sfn "$OLD_LINK" "$SITE_NEW" </dev/null || true
    sudo -n mv -T "$SITE_NEW" "$SITE_LINK" </dev/null || true
  else
    sudo -n rm -f "$SITE_LINK" </dev/null || true
  fi
  if [ "$CSP_ABSENT" = "no" ]; then
    sudo -n cp -p "$CSP_OLD" "$CSP_DST" </dev/null || true
  else
    sudo -n rm -f "$CSP_DST" </dev/null || true
  fi
  if sudo -n nginx -t </dev/null >/dev/null 2>&1; then
    if app_included; then sudo -n systemctl reload nginx </dev/null || true; fi
  fi
  echo "已恢复符号链接和 CSP 头。" >&2
}
trap rollback ERR

fail() {
  echo "错误：$1" >&2
  rollback
  exit 1
}

# ---------- 切换：先装 CSP 头，再原子换符号链接，最后 reload ----------
if [ "$CSP_SAME" = "yes" ]; then
  CSP_STATE=same
else
  sudo -n install -o root -g root -m 0644 "$CSP_SRC" "$CSP_DST" </dev/null
  CSP_STATE=installed
fi

SWAP_STATE=done
if [ "$OLD_LINK" = "releases/$VER" ] && [ "$REL_SAME" = "yes" ]; then
  SWAP_STATE=already
else
  sudo -n ln -sfn "releases/$VER" "$SITE_NEW" </dev/null
  sudo -n mv -T "$SITE_NEW" "$SITE_LINK" </dev/null
fi

RELOAD_STATE=skipped
if app_included; then
  if ! sudo -n nginx -t </dev/null >/dev/null 2>&1; then
    fail "nginx -t 没有通过。"
  fi
  if ! sudo -n systemctl reload nginx </dev/null; then
    fail "systemctl reload nginx 失败。"
  fi
  RELOAD_STATE=done
fi
trap - ERR

# ---------- 只保留最近 3 个版本目录（当前的和切换前的一定保留） ----------
sudo -n touch "$REL" </dev/null
mapfile -t DROP < <(sudo -n find "$REL_ROOT" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9a-f]{12}' -printf '%T@ %p\n' </dev/null | sort -rn | awk 'NR > 3 { print $2 }')
for d in "${DROP[@]}"; do
  case "$d" in
    "$REL_ROOT"/[0-9a-f]*) ;;
    *) continue ;;
  esac
  if [ "$d" = "$REL" ] || [ "$d" = "$REL_ROOT/${OLD_LINK#releases/}" ]; then continue; fi
  sudo -n rm -rf "$d" </dev/null
done

echo "SITE_VERSION=$VER"
echo "SITE_FILES=${#SITE_LIST[@]}"
echo "SITE_SWAP=$SWAP_STATE"
echo "CSP_CONF=$CSP_STATE"
echo "NGINX_RELOAD=$RELOAD_STATE"
