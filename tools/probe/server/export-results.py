# export-results.py —— 只读导出探针结果（Phase 6，06-10 Task 1，D-04、D-17）
#
# 用途：把 probe_results 表导出成一个 JSON 数组，交给本机的 summarize.mjs 汇总。
# 运行方式：经标准输入运行，从不存到服务器；本机一侧把输出重定向到被 git 忽略的 private/probe-results/：
#   ssh -o BatchMode=yes usj 'sudo -n python3 -I -' < tools/probe/server/export-results.py > private/probe-results/<YYYYMMDD-HHMM>.json
# 会改什么：什么都不改。数据库用 mode=ro 只读打开，只执行一条对 probe_results 的 SELECT，
#           不读用户表、超级用户表、日志表或任何其他表；不写服务器上的任何文件。
# 只用 Python 标准库。
# 输出：stdout 是 JSON 数组（UTF-8），按 created 升序，每条记录只含 FIELDS 里的列；
#       json 类型的列（push_ms、events）原样作为字符串输出，summarize.mjs 会解析；
#       bool 类型的列（login_ok）数据库里存成 0 或 1，这里转成 JSON 的 true 或 false。
# 失败策略：数据库打不开或查询出错时，stderr 写一行固定说明并以退出码 1 结束，stdout 不输出任何内容。
# FIELDS 与 tools/probe/schema.json 里 probe_results 的 28 个字段（含 created）逐个相同，
# 本机用 node tools/probe/schema-check.mjs --export 比对。
# 回滚：不需要（只读）。

import json
import sqlite3
import sys

DB_URI = "file:/var/lib/pocketbase/pb_data/data.db?mode=ro"

FIELDS = [
    "run_id",
    "carrier",
    "net",
    "browser",
    "started_at",
    "tz_offset_min",
    "dur_s",
    "nav_type",
    "fs_src",
    "first_screen_ms",
    "ttfb_ms",
    "load_ms",
    "dns_ms",
    "connect_ms",
    "tls_ms",
    "sdk_ms",
    "api_rtt_ms",
    "login_ms",
    "login_ok",
    "rt_connect_ms",
    "hidden_ms",
    "drops",
    "max_reconnect_ms",
    "pings_ok",
    "pings_total",
    "push_ms",
    "events",
    "created",
]

BOOL_FIELDS = ("login_ok",)


def fail():
    sys.stderr.write("export-results: cannot read the probe_results table\n")
    sys.exit(1)


def main():
    try:
        con = sqlite3.connect(DB_URI, uri=True, timeout=5)
        query = "SELECT " + ", ".join('"%s"' % name for name in FIELDS) + ' FROM "probe_results" ORDER BY "created" ASC'
        records = con.execute(query).fetchall()
        con.close()
    except Exception:
        fail()

    rows = []
    for record in records:
        row = {}
        for name, value in zip(FIELDS, record):
            if name in BOOL_FIELDS and value is not None:
                value = bool(value)
            row[name] = value
        rows.append(row)

    sys.stdout.buffer.write((json.dumps(rows, ensure_ascii=False) + "\n").encode("utf-8"))


main()
