# API Coverage — PocketBase JS SDK 0.28.1（服务器 0.41.1）

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> 范围：Phase 10 用到的 PocketBase 能力（实时订阅、记录读写、令牌刷新）。登录、退出、按 kind 建文档在 Phase 9 已接入，这里一并列出以便看清全貌。

| capability | decision | reason |
|---|---|---|
| realtime.subscribe(collection "*", fields) | INTEGRATE | |
| realtime.subscribe("PB_CONNECT") | INTEGRATE | |
| realtime.onDisconnect | INTEGRATE | |
| realtime.unsubscribe() | INTEGRATE | |
| realtime.unsubscribeByPrefix | OPT-OUT | not needed — the app keeps one subscription set and always clears it whole |
| realtime.subscribe(single record id topic) | OPT-OUT | not needed — the collection topic already covers both documents of the account |
| records.getFullList | INTEGRATE | |
| records.getOne | OPT-OUT | not needed — one list request returns both documents and merges requests (10-01) |
| records.getList / getFirstListItem | OPT-OUT | not needed — each account has exactly two documents |
| records.create | INTEGRATE | |
| records.update | INTEGRATE | |
| records.delete | OPT-OUT | explicitly out of scope — deleteRule is null, clients can never delete (Phase 8) |
| REST query option fields | OPT-OUT | not needed yet — no recorded sample and the fake server does not implement it; revisit in Phase 13 with a real-instance sample |
| users.authWithPassword | INTEGRATE | |
| users.authRefresh | INTEGRATE | |
| authStore (token, isValid, record, clear, onChange) | INTEGRATE | |
| users.authWithOAuth2 / authWithOTP / MFA | OPT-OUT | explicitly out of scope — disabled on the server (ACCT-03, REQUIREMENTS Out of Scope) |
| users.requestPasswordReset / requestVerification / requestEmailChange / confirm* | OPT-OUT | explicitly out of scope — passwords are reset by the owner in the admin (REQUIREMENTS Out of Scope) |
| users.impersonate / listAuthMethods | OPT-OUT | not needed — superuser-only or no alternative auth methods exist |
| files | OPT-OUT | not needed — documents are JSON only |
| batch | OPT-OUT | not needed — at most one write per sync |
| collections / settings / logs / backups / crons / health | OPT-OUT | explicitly out of scope — superuser-only administration, not used by the app |
