# anchor-block.awk —— 确认 certbot 锚点所在的 server 块是 listen 443 ssl 的块（Phase 6，06-07，T-06-32）
#
# 用途：05-nginx-probe.sh 在改任何东西之前调用它，确认要在其后插入 include 的那一行
#   （`server_name … # managed by Certbot`）确实在监听 443 ssl 的 server 块里；
#   也可以经标准输入只读地在服务器上运行，程序不存到服务器：
#     ssh -o BatchMode=yes usj 'sudo -n awk -f /dev/stdin "$(readlink -f /etc/nginx/sites-enabled/default)"' < tools/probe/server/nginx/anchor-block.awk
#
# 只用 POSIX awk 语法（服务器上的 awk 是 mawk；本机用 gawk --posix 测）：不用 gensub、三参数 match、
#   正则区间 {n}、\y 之类的扩展；花括号写成 [{] 和 [}]。
#
# 做法：逐行处理。先把行里 # 之后的注释去掉得到“指令部分”（锚点判断用原始行，因为锚点本身带注释）；
#   按指令部分里花括号的个数维护深度；深度为 0 时遇到以 server 开头并带 { 的行，开始一个 server 块；
#   块内记录“含锚点行”和“含 listen 443 ssl”（端口位置是 443，前面是空白或冒号，后面是空白、分号或行尾，
#   并且同一条 listen 指令里有独立的 ssl 参数）；深度回到 0 时结算这个块。
#
# 输出：只输出一行，不输出配置内容（里面有域名）。
#   ANCHOR_BLOCK=443ssl   锚点恰好 1 行，且它所在的 server 块含 listen 443 ssl      退出码 0
#   ANCHOR_BLOCK=none     没有锚点行                                                  退出码 1
#   ANCHOR_BLOCK=multiple 锚点行多于 1 行                                             退出码 1
#   ANCHOR_BLOCK=other    恰好 1 行，但它所在的块不是 listen 443 ssl（例如在 :80 块里，或 443 不带 ssl）  退出码 1

BEGIN {
  depth = 0
  inblk = 0
  anchors = 0
  blk_anchor = 0
  blk_ssl = 0
  anchor_in_ssl = 0
}

{
  raw = $0
  code = raw
  sub(/#.*/, "", code)

  if (depth == 0 && code ~ /^[ \t]*server[ \t]*[{]/) {
    inblk = 1
    blk_anchor = 0
    blk_ssl = 0
  }

  if (raw ~ /^[ \t]*server_name .*# managed by Certbot$/) {
    anchors++
    if (inblk) blk_anchor++
  }

  if (inblk && code ~ /^[ \t]*listen[ \t]/) {
    rest = code
    sub(/^[ \t]*listen[ \t]+/, " ", rest)
    if (rest ~ /(^|[ \t:])443([ \t;]|$)/ && rest ~ /(^|[ \t])ssl([ \t;]|$)/) blk_ssl = 1
  }

  opens = code
  closes = code
  n_open = gsub(/[{]/, "", opens)
  n_close = gsub(/[}]/, "", closes)
  depth += n_open - n_close
  if (depth < 0) depth = 0

  if (inblk && depth == 0) {
    if (blk_anchor > 0 && blk_ssl) anchor_in_ssl = 1
    inblk = 0
  }
}

END {
  if (anchors == 0) { print "ANCHOR_BLOCK=none"; status = 1 }
  else if (anchors > 1) { print "ANCHOR_BLOCK=multiple"; status = 1 }
  else if (anchor_in_ssl) { print "ANCHOR_BLOCK=443ssl"; status = 0 }
  else { print "ANCHOR_BLOCK=other"; status = 1 }
  exit status
}
