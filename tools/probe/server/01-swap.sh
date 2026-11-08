#!/usr/bin/env bash
# 01-swap.sh —— 批次 A 第 1 步：建 1 GB 的 swap 文件（Phase 6，06-06，D-14）
#
# 用途：服务器内存只有约 0.9 GB 且没有 swap，给 PocketBase 和 nginx 加一道 OOM 保险。
# 会改什么（需要所有者批准，D-04）：
#   - 新建 /swapfile（1 GB，root:root，权限 600），mkswap 并 swapon；
#   - 在 /etc/fstab 里追加一行 "/swapfile none swap sw 0 0"，追加之前先把 /etc/fstab 备份成
#     /etc/fstab.usj-backup.<时间戳>；
#   - 不改 vm.swappiness（当前为 0，意味着只在极端内存压力下才用 swap，正合适）。
# 幂等：/swapfile 已经在 swapon 列表里就输出 SWAP=already 并退出 0，什么也不改。
# 失败策略：set -euo pipefail；根分区可用空间不足 2 GB、/swapfile 已存在但没有启用（说明上次中途失败，
#   不去覆盖一个来历不明的文件）都报错退出，不做任何改动。
# 回滚：
#   sudo swapoff /swapfile && sudo rm -f /swapfile
#   然后把 /etc/fstab 恢复成备份（最新的 /etc/fstab.usj-backup.<时间戳>），或删掉 "/swapfile none swap sw 0 0" 那一行。
# 不打印口令、域名、IP；没有 set -x。

set -euo pipefail

SWAP_LIST=$(swapon --show=NAME --noheadings </dev/null 2>/dev/null || true)
if printf '%s\n' "$SWAP_LIST" | grep -qx '/swapfile'; then
  echo "SWAP=already"
  echo "SWAP_TOTAL_MB=$(free -m </dev/null | awk '/^Swap:/{print $2}')"
  exit 0
fi

if sudo -n test -e /swapfile </dev/null; then
  echo "错误：/swapfile 已存在但没有启用。请先查明它是什么，再决定是否删除；本脚本不覆盖它。" >&2
  exit 1
fi

AVAIL_GB=$(df -BG --output=avail / </dev/null | tail -n 1 | tr -dc '0-9')
if [ -z "$AVAIL_GB" ] || [ "$AVAIL_GB" -lt 2 ]; then
  echo "错误：根分区可用空间不足 2 GB（读到 ${AVAIL_GB:-空} GB），不建 swap 文件。" >&2
  exit 1
fi

# 先建一个 600 权限的空文件，再给它分配空间，文件从出生起就不是所有人可读
sudo -n install -o root -g root -m 0600 /dev/null /swapfile </dev/null
if ! sudo -n fallocate -l 1G /swapfile </dev/null; then
  echo "fallocate 失败，改用 dd 写 1024 个 1 MiB 块" >&2
  sudo -n dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none </dev/null
fi
sudo -n chmod 600 /swapfile </dev/null
sudo -n mkswap /swapfile </dev/null >/dev/null
sudo -n swapon /swapfile </dev/null

if ! sudo -n grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab </dev/null; then
  sudo -n cp -p /etc/fstab "/etc/fstab.usj-backup.$(date +%Y%m%d%H%M%S)" </dev/null
  # 保证最后一行以换行结尾，再追加
  if [ -n "$(sudo -n tail -c 1 /etc/fstab </dev/null)" ]; then
    printf '\n' | sudo -n tee -a /etc/fstab >/dev/null
  fi
  printf '/swapfile none swap sw 0 0\n' | sudo -n tee -a /etc/fstab >/dev/null
fi

echo "SWAP=created"
echo "SWAP_TOTAL_MB=$(free -m </dev/null | awk '/^Swap:/{print $2}')"
