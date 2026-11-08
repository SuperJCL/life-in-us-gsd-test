#!/usr/bin/env bash
# 02-install-pocketbase.sh —— 批次 A 第 2 步：安装固定版本的 PocketBase（Phase 6，06-06，D-03、D-16、D-17）
#
# 用途：下载 PocketBase 预编译包，核对 SHA-256，装到 /opt/pocketbase/pocketbase，建系统用户和数据目录。
# 会改什么（需要所有者批准，D-04；这是本阶段第一次在服务器上下载，D-17）：
#   - 从网上下载 pocketbase_<版本>_linux_amd64.zip 和 checksums.txt 到一个 mktemp 临时目录（退出时删除）；
#   - 创建系统用户 pocketbase（nologin、无家目录创建）；
#   - 创建目录：/opt/pocketbase、/opt/pocketbase/dist（root:root 0755）；
#     /var/lib/pocketbase（pocketbase 0750）及其下 pb_data（0700）、pb_migrations、pb_public（0750）；
#   - 安装程序 /opt/pocketbase/pocketbase（root:root 0755，pocketbase 用户只读、不能改写自己），
#     并把核对过的 zip 以 0644 存到 /opt/pocketbase/dist/；
#   - 不装任何系统包（用 python3 -I -m zipfile 解压，不用 unzip）；不启动服务；不碰 nginx、certbot、Node、PM2。
# 版本和信任模型（D-16）：
#   默认 PB_VERSION=0.41.1，来源只有维护者站点一个（checksums.txt 与 zip 在同一个站点、没有签名），
#   所以把调研时核对过的 zip SHA-256 钉死在本脚本里；下载后 zip 的哈希必须等于钉死值，
#   并且与 checksums.txt 里该 zip 那一行一致，任一不符就以 HASH MISMATCH 中止，什么都不安装。
#   两项核对和 --version 检查都在改动系统之前（用户、目录、安装）完成。
#   备选 PB_VERSION=0.40.6（GitHub 来源，GitHub 与 checksums.txt 两处哈希互相印证）只能在所有者另行批准后
#   用 PB_VERSION=0.40.6 运行；其他版本一律拒绝。
# 幂等：已装且 --version 输出的就是同一版本，输出 PB_INSTALL=already 并退出 0；
#   已装但版本不同，报错退出（本脚本不做升级，也不用 pocketbase update）。
# 失败策略：set -euo pipefail；缺 curl、python3、sha256sum 时报错退出，不去装包；下载用
#   curl -fsSL --proto '=https' --tlsv1.2（地址会 307 跳转，所以必须带 -L；跳转同样只许 https）。
# 回滚：
#   sudo rm -rf /opt/pocketbase /var/lib/pocketbase && sudo userdel pocketbase
#   （数据目录里只有合成数据；若 03 脚本已运行，还要删 /var/www/usj/probe/config.js）
# 不打印口令、域名、IP；没有 set -x。

set -euo pipefail

PB_VERSION="${PB_VERSION:-0.41.1}"
case "$PB_VERSION" in
  0.41.1)
    BASE_URL='https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1'
    PINNED_SHA256='7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e'
    ;;
  0.40.6)
    BASE_URL='https://github.com/pocketbase/pocketbase/releases/download/v0.40.6'
    PINNED_SHA256='0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f'
    ;;
  *)
    echo "错误：不支持的 PB_VERSION（只有 0.41.1 和经所有者另行批准的 0.40.6）。" >&2
    exit 1
    ;;
esac
ZIP_NAME="pocketbase_${PB_VERSION}_linux_amd64.zip"

for tool in curl python3 sha256sum install; do
  if ! command -v "$tool" </dev/null >/dev/null 2>&1; then
    echo "错误：服务器上缺少 $tool；本脚本不装系统包。" >&2
    exit 1
  fi
done

version_of() {
  # 以 pocketbase 用户运行 --version，只取 x.y.z
  sudo -n -u pocketbase /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data --version </dev/null 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true
}

if [ -x /opt/pocketbase/pocketbase ] && id pocketbase </dev/null >/dev/null 2>&1; then
  HAVE_VERSION=$(version_of)
  if [ "$HAVE_VERSION" = "$PB_VERSION" ]; then
    echo "PB_INSTALL=already"
    echo "PB_BINARY_VERSION=$HAVE_VERSION"
    exit 0
  fi
  echo "错误：/opt/pocketbase/pocketbase 已存在，版本是 ${HAVE_VERSION:-未知}，不是 $PB_VERSION。本脚本不做升级。" >&2
  exit 1
fi

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

# ---------- 下载 ----------
curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 --max-redirs 5 --max-time 180 -o "$T/pb.zip" "${BASE_URL}/${ZIP_NAME}" </dev/null
curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 --max-redirs 5 --max-time 60 -o "$T/checksums.txt" "${BASE_URL}/checksums.txt" </dev/null

# ---------- 核对 1：钉死的哈希 ----------
ACTUAL_SHA256=$(sha256sum "$T/pb.zip" </dev/null | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$PINNED_SHA256" ]; then
  echo "HASH MISMATCH: 下载的 zip 与脚本里钉死的 SHA-256 不一致，已中止，什么都没有安装。" >&2
  exit 1
fi
echo "PB_SHA256_PINNED_MATCH=yes"

# ---------- 核对 2：checksums.txt 里该 zip 那一行 ----------
LISTED_SHA256=$(awk -v n="$ZIP_NAME" '$2 == n || $2 == "*" n {print $1}' "$T/checksums.txt" </dev/null || true)
if [ "$(printf '%s\n' "$LISTED_SHA256" | grep -c .)" != "1" ] || [ "$LISTED_SHA256" != "$PINNED_SHA256" ]; then
  echo "HASH MISMATCH: checksums.txt 里 ${ZIP_NAME} 的哈希缺失、不唯一或与钉死值不一致，已中止，什么都没有安装。" >&2
  exit 1
fi
echo "PB_SHA256_CHECKSUMS_MATCH=yes"

# ---------- 解压（只取 pocketbase 这个文件） ----------
mkdir "$T/x"
python3 -I -m zipfile -e "$T/pb.zip" "$T/x" </dev/null
if [ ! -f "$T/x/pocketbase" ]; then
  echo "错误：zip 里没有 pocketbase 文件，已中止。" >&2
  exit 1
fi

# ---------- 以下才开始改动系统 ----------
if ! id pocketbase </dev/null >/dev/null 2>&1; then
  sudo -n useradd --system --user-group --home-dir /var/lib/pocketbase --no-create-home --shell /usr/sbin/nologin pocketbase </dev/null
fi

sudo -n install -d -o root -g root -m 0755 /opt/pocketbase /opt/pocketbase/dist </dev/null
sudo -n install -d -o pocketbase -g pocketbase -m 0750 /var/lib/pocketbase </dev/null
sudo -n install -d -o pocketbase -g pocketbase -m 0700 /var/lib/pocketbase/pb_data </dev/null
sudo -n install -d -o pocketbase -g pocketbase -m 0750 /var/lib/pocketbase/pb_migrations /var/lib/pocketbase/pb_public </dev/null

sudo -n install -o root -g root -m 0755 "$T/x/pocketbase" /opt/pocketbase/pocketbase </dev/null
sudo -n install -o root -g root -m 0644 "$T/pb.zip" "/opt/pocketbase/dist/${ZIP_NAME}" </dev/null

INSTALLED_VERSION=$(version_of)
if [ "$INSTALLED_VERSION" != "$PB_VERSION" ]; then
  echo "错误：安装后 --version 输出的是 ${INSTALLED_VERSION:-空}，不是 $PB_VERSION。" >&2
  exit 1
fi

echo "PB_INSTALL=done"
echo "PB_BINARY_VERSION=$INSTALLED_VERSION"
