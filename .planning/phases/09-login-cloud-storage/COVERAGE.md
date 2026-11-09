# API Coverage — PocketBase 0.41.1 (JS SDK 0.28.1, same-origin)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| users.auth-with-password | INTEGRATE | |
| users.auth-refresh | INTEGRATE | |
| journey_docs.list | INTEGRATE | |
| journey_docs.view | INTEGRATE | |
| journey_docs.create | INTEGRATE | |
| journey_docs.update | INTEGRATE | |
| realtime.unsubscribe | INTEGRATE | |
| journey_docs.delete | OPT-OUT | explicitly out of scope: deleteRule is null by design (Phase 8), the client never deletes documents |
| realtime.subscribe | OPT-OUT | not needed yet: realtime sync is Phase 10 (SYNC-02); Phase 9 only unsubscribes during logout |
| users.create (self-registration) | OPT-OUT | explicitly out of scope: accounts are created only by the owner in the admin UI (ACCT-03) |
| users.update (change password or email) | OPT-OUT | explicitly out of scope: no password or email UI this milestone (08-CONTEXT D-07) |
| users.request-password-reset and confirm | OPT-OUT | explicitly out of scope: no password-reset email, the owner resets passwords (REQUIREMENTS Out of Scope) |
| users.auth-methods, oauth2, otp, mfa | OPT-OUT | explicitly out of scope: password login only, no third-party login (REQUIREMENTS Out of Scope) |
| files | OPT-OUT | not needed: the app stores no files |
| batch | OPT-OUT | not needed: two documents per account, single requests suffice |
| superuser APIs (collections, settings, logs, backups) | OPT-OUT | explicitly out of scope: owner-only operations, never called from the web app |
