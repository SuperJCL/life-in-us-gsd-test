#!/usr/bin/env bash
# 06-install-probe-page.sh —— 批次 B 最后一步：核对 SDK 哈希后安装探针页（Phase 6，06-07，D-09、D-15）
#
# 前提：已上传并核对过 /tmp/usj-probe-upload/page/（index.html、probe.js、vendor/pocketbase.iife.js、vendor/SHA256SUMS）；
#   批次 A 的 03-configure-pocketbase.sh 已经生成了 /var/www/usj/probe/config.js。
# 会改什么（需要所有者批准，D-04）：
#   - 先在服务器上用 SHA256SUMS 核对 SDK 文件，不通过就退出 1，什么都不装；
#   - 建 /var/www/usj、/var/www/usj/probe、/var/www/usj/probe/vendor（root 所有，目录 0755）；
#   - 装 index.html 和 probe.js 到 /var/www/usj/probe/，pocketbase.iife.js 到 /var/www/usj/probe/vendor/（root 所有，文件 0644）；
#   - 不覆盖 config.js（含合成探针账号，由 03 脚本生成），也不拷贝占位示例文件；config.js 不存在时只警告，不生成；
#   - 最后删除整个上传目录。所以这一步必须放在批次 B 的最后：04 和 05 还要用到上传目录里的文件。
# 输出：KEY=VALUE。PROBE_PAGE=done、PROBE_PAGE_FILES=、PROBE_CONFIG_JS=present|absent。
# 失败策略：set -euo pipefail；没有 set -x；可能读标准输入的命令都带 </dev/null。
# 回滚：sudo rm -rf /var/www/usj/probe/index.html /var/www/usj/probe/probe.js /var/www/usj/probe/vendor（config.js 不在回滚范围内）。

set -euo pipefail

UP=/tmp/usj-probe-upload/page
WEB=/var/www/usj/probe

for f in "$UP/index.html" "$UP/probe.js" "$UP/vendor/pocketbase.iife.js" "$UP/vendor/SHA256SUMS"; do
  if [ ! -f "$f" ]; then
    echo "错误：缺少上传的文件 $f，请先按批准清单上传。" >&2
    exit 1
  fi
done

# ---------- 先核对 SDK 文件（任何安装之前） ----------
if ! grep -qE '[ *]pocketbase\.iife\.js$' "$UP/vendor/SHA256SUMS" </dev/null; then
  echo "错误：SHA256SUMS 里没有 SDK 文件的条目，未安装任何东西。" >&2
  exit 1
fi
if ! (cd "$UP/vendor" && sha256sum -c SHA256SUMS </dev/null >/dev/null 2>&1); then
  echo "错误：SDK 文件的 sha256 与 SHA256SUMS 不一致，未安装任何东西。" >&2
  exit 1
fi

# ---------- 安装 ----------
sudo -n install -d -o root -g root -m 0755 /var/www/usj /var/www/usj/probe /var/www/usj/probe/vendor </dev/null
sudo -n install -o root -g root -m 0644 "$UP/index.html" "$WEB/index.html" </dev/null
sudo -n install -o root -g root -m 0644 "$UP/probe.js" "$WEB/probe.js" </dev/null
sudo -n install -o root -g root -m 0644 "$UP/vendor/pocketbase.iife.js" "$WEB/vendor/pocketbase.iife.js" </dev/null

if sudo -n test -f "$WEB/config.js" </dev/null; then
  echo "PROBE_CONFIG_JS=present"
else
  echo "警告：$WEB/config.js 不存在（由 03-configure-pocketbase.sh 生成）。探针页没有它无法登录。" >&2
  echo "PROBE_CONFIG_JS=absent"
fi

# ---------- 清理上传目录 ----------
rm -rf /tmp/usj-probe-upload

N_FILES="$(sudo -n find "$WEB" -type f </dev/null 2>/dev/null | wc -l | tr -d ' ')"
echo "PROBE_PAGE=done"
echo "PROBE_PAGE_FILES=${N_FILES:-0}"
