#!/usr/bin/env bash
# 01-swap.sh —— 建 1 GB 的 swap 文件，并保证 /etc/fstab 里有它（Phase 13，13-06，D-11、WR-07；由 Phase 6 的同名脚本改来）
#
# 用途：服务器内存只有约 0.9 GB，给 PocketBase 和 nginx 加一道 OOM 保险；重启后 swap 要自己回来，所以 fstab 必须有那一行（OPS-02）。
# 前提：无（不读上传目录）。
# 会改什么（需要所有者批准）：
#   - 先确保 /etc/fstab 里有一行 "/swapfile none swap sw 0 0"：没有就先把 /etc/fstab 备份成 /etc/fstab.usj-backup.<时间戳> 再追加。
#     这一步放在“swap 已经启用就退出”的判断之前（WR-07）：Phase 6 的版本在 swap 已启用时直接 already 退出，
#     fstab 缺行时重跑也补不上，重启后 swap 就丢了；
#   - swap 还没启用时：新建 /swapfile（1 GB，root:root，权限 600），mkswap 并 swapon；
#   - 不改 vm.swappiness。
# 输出：KEY=VALUE。SWAP_FSTAB=present|added、SWAP=created|already、SWAP_TOTAL_MB=。
# 幂等：/swapfile 已经在 swapon 列表里且 fstab 有那一行，就只输出 SWAP_FSTAB=present、SWAP=already，什么也不改。
# 失败策略：set -euo pipefail；根分区可用空间不足 2 GB、/swapfile 已存在但没有启用（说明上次中途失败，
#   不去覆盖一个来历不明的文件）都报错退出，不建文件（fstab 那一步已经补上的话保持补上的状态）。
# 回滚：
#   sudo swapoff /swapfile && sudo rm -f /swapfile
#   然后把 /etc/fstab 恢复成备份（最新的 /etc/fstab.usj-backup.<时间戳>），或删掉 "/swapfile none swap sw 0 0" 那一行。
# 不打印口令、域名、IP；没有 set -x。

set -euo pipefail

# ---------- 先确保 fstab 有 swap 那一行（WR-07：必须在 already 退出之前） ----------
SWAP_FSTAB=present
if ! sudo -n grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab </dev/null; then
  sudo -n cp -p /etc/fstab "/etc/fstab.usj-backup.$(date +%Y%m%d%H%M%S)" </dev/null
  # 保证最后一行以换行结尾，再追加
  if [ -n "$(sudo -n tail -c 1 /etc/fstab </dev/null)" ]; then
    printf '\n' | sudo -n tee -a /etc/fstab >/dev/null
  fi
  printf '/swapfile none swap sw 0 0\n' | sudo -n tee -a /etc/fstab >/dev/null
  SWAP_FSTAB=added
fi
echo "SWAP_FSTAB=$SWAP_FSTAB"

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

echo "SWAP=created"
echo "SWAP_TOTAL_MB=$(free -m </dev/null | awk '/^Swap:/{print $2}')"
