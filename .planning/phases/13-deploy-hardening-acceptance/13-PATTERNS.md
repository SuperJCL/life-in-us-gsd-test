# Phase 13: 部署、加固与验收 - Pattern Map

**Mapped:** 2026-11-11
**Files analyzed:** 27 (new/modified)
**Analogs found:** 25 / 27

All paths are repo-relative. All analogs below are git-tracked (checked via `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `deploy/server/pocketbase.service` | config (systemd) | daemon | `tools/probe/server/pocketbase.service` | exact |
| `deploy/server/nginx/usj-app.conf` | config (nginx) | request-response + SSE | `tools/probe/server/nginx/usj-probe-locations.conf` | exact |
| `deploy/server/nginx/usj-headers-common.conf` | config (nginx) | request-response | per-location `add_header` blocks in the same probe conf | role-match |
| `deploy/server/nginx/anchor-block.awk` | utility | transform | `tools/probe/server/nginx/anchor-block.awk` | exact (copy) |
| `deploy/server/05-nginx-app.sh` | server script | batch, rollback | `tools/probe/server/05-nginx-probe.sh` | exact |
| `deploy/server/04-start-pocketbase.sh` | server script | batch | `tools/probe/server/04-start-pocketbase.sh` | exact |
| `deploy/server/00-status.sh`, `01-swap.sh`, `02-install-pocketbase.sh`, `03-configure-pocketbase.sh` | server script | batch | same-numbered files in `tools/probe/server/` | exact (fix WR-07/08/09, IN-06/07/09/11) |
| `deploy/server/06-install-site.sh` | server script | file-I/O | `tools/probe/server/06-install-probe-page.sh` | role-match |
| `deploy/server/07-retire-probe.sh` | server script | batch | `03-configure-pocketbase.sh`, `04-start-pocketbase.sh` (style only) | partial |
| `deploy/server/pb-admin.sh` | server script | wrapper | `04-start-pocketbase.sh` (`sudo -n -u pocketbase`) | partial |
| `deploy/server/restore-drill.sh` | server script | batch | `tools/probe/server/*.sh` header and output style | partial |
| `deploy/server/logrotate/usj-nginx` | config | batch | none | no analog |
| `deploy/pb_migrations/1794096200_server_settings.js` | migration | CRUD (settings) | `tools/probe/server/pb_migrations/probe_schema.js` (settings part) | role-match |
| `deploy/pb_hooks/backup-watch.pb.js` | hook | event-driven | none in repo | no analog |
| `deploy/build-site.mjs` | build script | transform, file-I/O | `tools/plan/migrate-backup.mjs`, `tools/privacy/privacy-check.mjs` (`--self-test`) | role-match |
| `deploy/make-icons.mjs` | script | file-I/O | `tools/pb/fetch-local-pb.mjs` (zero-dep CLI style) | partial |
| `deploy/verify-site.mjs` | script | request-response | `tools/probe/verify-site.mjs` | exact |
| `deploy/site/sw.js` | service worker | event-driven | none | no analog |
| `deploy/site/manifest.webmanifest`, `deploy/site/icons/*.png` | asset | static | none | no analog |
| `deploy/README.md` | doc | n/a | `tools/probe/README.md` | exact |
| `us-journey-tracker.html` (manifest link, apple-touch, SW registration, update banner, robots meta) | app | event-driven | same file: `.syncbar` banner, `readConfig()` | exact |
| `tests/support/constants.ts` (`APP_SHA256`) | test config | n/a | self | exact |
| `tests/support/test.ts` (`V1_APP_PATHS`, `CLOUD_APP_PATHS`) | test util | n/a | self | exact |
| `tests/support/static-server.cjs` | test util | request-response | self (whitelist) | exact |
| `playwright.config.ts`, `playwright.cloud.config.ts` | config | n/a | `serviceWorkers: 'block'` (line 53) | exact |
| new offline cold-start spec under `tests/cloud/` | test | event-driven | `tests/support/app-variant.ts` plus existing `tests/cloud/*` | role-match |
| `.gitattributes` | config | n/a | existing rules | exact |

## Pattern Assignments

### `deploy/server/pocketbase.service` (systemd)

**Analog:** `tools/probe/server/pocketbase.service`. Keep it verbatim, then change only these things:
- `Description` and header comments.
- `ExecStart` stays on `127.0.0.1:8090` with an explicit `--dir`.
- Add `EnvironmentFile=/etc/usj/pocketbase.env` (research §1). Do NOT use inline `Environment=KEY=value` for secrets: privacy rule G rejects it. `Environment=GOMEMLIMIT=256MiB` is non-secret and is already in the analog.
- Probably raise `MemoryMax` for backups.
- Add `ReadWritePaths` for any backup directory.
- Keep `pb_public` and `--indexFallback=false`.

Excerpt to keep (lines 21-45 of the analog):
```ini
[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/var/lib/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=/var/lib/pocketbase/pb_data --publicDir=/var/lib/pocketbase/pb_public --indexFallback=false --hooksWatch=false
Environment=GOMEMLIMIT=256MiB
Restart=always
RestartSec=5s
MemoryHigh=320M
MemoryMax=400M
OOMScoreAdjust=300
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/pocketbase
```
Explicit `--dir` matters (Pitfall 12). Hooks live in `pb_hooks` under the data dir, so the `--hooksWatch=false` choice needs a restart on deploy.

### `deploy/server/nginx/usj-app.conf`

**Analog:** `tools/probe/server/nginx/usj-probe-locations.conf`.

The file contains only `location` blocks: no `listen`, `ssl_certificate` or `server_name`. It is included after the certbot anchor line.

Copy these exactly:
- The SSE block `location = /api/realtime`. It uses `proxy_http_version 1.1`, `proxy_set_header Connection ""`, `proxy_buffering off`, `proxy_cache off`, `gzip off`, `proxy_read_timeout 3600s`, and `X-Real-IP $remote_addr`.
- The `^~ /api/` and `^~ /_/` blocks.

Changes:
- `client_max_body_size 1m` becomes at least `5m` on `/api/` (the app doc limit is 4 MiB). Keep it on `/api/realtime`.
- Remove `access_log off` (D-03: 30-day access log). Per-location `access_log off` is now wrong. Add a log path if you use a custom one.
- Replace the `/probe/` block with `location = /`, `= /sw.js` (`Cache-Control: no-cache`), `= /manifest.webmanifest` (explicit `types{}`), `^~ /vendor/`, and `^~ /icons/`. Use `root /var/www/usj/site`.
- Because `add_header` does not inherit, every location must `include snippets/usj-headers-common.conf;`. It holds `X-Content-Type-Options`, `Referrer-Policy`, `X-Robots-Tag` and `Content-Security-Policy`. The CSP file comes from the `build-site.mjs` output (`usj-csp.conf`).
- The 3 proxy blocks should include the headers too, except that CSP is only needed for HTML.
- Keep `server_tokens off` on all locations.
- `gzip_types` must add `text/javascript application/javascript`.

The `/probe/` static block (analog lines ~71-82) is the template for the static locations:
```nginx
location ^~ /probe/ {
    root /var/www/usj;
    add_header Cache-Control "no-store" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    gzip on;
    gzip_types text/css application/javascript text/javascript application/json;
    server_tokens off;
}
```

### `deploy/server/05-nginx-app.sh`

**Analog:** `tools/probe/server/05-nginx-probe.sh`. Copy the whole flow:
1. `set -euo pipefail`, with a Chinese header comment that has these sections: prerequisite, what changes, output `KEY=VALUE`, failure policy, rollback.
2. Pre-checks before touching anything: the anchor regex `ANCHOR_RE='^[[:space:]]*server_name .*# managed by Certbot$'` must match exactly 1 line, and `awk -f anchor-block.awk` must output `ANCHOR_BLOCK=443ssl`.
3. Timestamped backup into `/etc/nginx/usj-backup` (outside nginx's loaded dirs).
4. A `rollback()` function (`cp -p` backup, restore or delete the snippet, `nginx -t` then reload).
5. Install the snippet.
6. Idempotent include insertion with awk.
7. Verify the include count is 1.
8. `nginx -t`, reload (not restart), `certbot renew --dry-run`.

Required changes:
- Fix WR-09 (rerun path). The probe include `include snippets/usj-probe-locations.conf; # usj-probe` must be replaced by the app include on a rerun, and the old snippet removed. The count check must tolerate that.
- Update the upload dir variable (`UP=/tmp/usj-probe-upload/server/nginx`) to a deploy-specific name.
- Install two snippets (`usj-app.conf`, `usj-headers-common.conf`, plus the CSP conf).
- Every command that might read stdin carries `</dev/null`. `sudo -n` throughout.

Key excerpt (analog lines 54-60, 62-72) to preserve:
```bash
N_ANCHOR="$(sudo -n grep -cE "$ANCHOR_RE" "$SITE" </dev/null || true)"
if [ "$N_ANCHOR" != "1" ]; then echo "错误：锚点行数不是 1 ..." >&2; exit 1; fi
KIND="$(sudo -n awk -f .../anchor-block.awk "$SITE" </dev/null)" || true
[ "$KIND" != "ANCHOR_BLOCK=443ssl" ] && exit 1
```

### `deploy/server/04-start-pocketbase.sh` and `02`, `03`, `00`, `01`

**Analog:** same-numbered files in `tools/probe/server/`.

Pattern from `04-start-pocketbase.sh`:
- A precheck: `_superusers` has at least 1 row, read through `sudo -n -u pocketbase python3 -I - <<'PY'` with a read-only sqlite URI. This stops PocketBase from printing a one-time install link into the journal.
- After the unit is installed, a 30-second health check.
- On failure, print redacted journal lines, stop the service, exit 1.
- A check that 8090 is bound only to 127.0.0.1.
- Output `KEY=VALUE`, e.g. `PB_START=done`.

Changes:
- Fix WR-08 and the other rerun-only defects named in D-11.
- Use `restart` when the unit changes (research table).
- `03` must install `deploy/pb_migrations/*` and `deploy/pb_hooks/*`, plus `pb/pb_migrations/1794096000_users_lockdown.js` and `1794096100_journey_docs.js` copied as-is.
- `03` must generate the encryption key file without printing it, and no longer generate the probe account (`probe_user.js.tpl` is dropped).
- `02` keeps the pinned SHA-256 for 0.41.1 and 0.40.6 (fallback), and answers `already` if the same version is installed.

### `deploy/server/06-install-site.sh`

**Analog:** `tools/probe/server/06-install-probe-page.sh`. Read it when planning (it was not excerpted). Change it into an atomic swap of `/var/www/usj/site`, with a SHA256SUMS check that accepts both the `  ` and ` *` separators (06-08-SUMMARY).

### `deploy/pb_migrations/1794096200_server_settings.js`

**Analog:** `tools/probe/server/pb_migrations/probe_schema.js`. Its settings part (the end of the file) sets rate limits, trusted proxy header and logs. Copy that style: `migrate((app) => { ... app.save(settings) })` with a comment header saying that it contains no credentials.

Header pattern:
```js
// 用途：PocketBase 启动时自动执行 ... 不含任何凭据
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  ...
  app.save(users)
```
Keep it out of `pb/pb_migrations/`. `tools/pb/migration-check.mjs` and `pb/rules.expected.json` read that directory and treat every collection save as a snapshot entry. This file does not touch collections, so it stays in `deploy/pb_migrations/`.
- Settings: `rateLimits`, `trustedProxy.headers = ["X-Real-IP"]`, `logs.maxDays=30` with IP logging on, and backups cron and S3 settings. Do not put the S3 key or SMTP password here (privacy rule G and D-02).
- If the plan wants a static check, mirror the `node:vm` sandbox of `tools/pb/migration-check.mjs` (lines 1-25 give the CLI and exit-code contract).

### `deploy/build-site.mjs`

**Analogs:** `tools/plan/migrate-backup.mjs` and `tools/probe/verify-site.mjs` for CLI conventions.

Pattern to copy:
- A header comment with usage, outputs, exit codes and a privacy convention.
- Zero dependencies (only `node:` built-ins).
- Mode parsing through `parseArgs(args)`, which returns `{ mode: 'self-test' }`, etc. (migrate-backup lines 235, 249).
- A `--self-test` mode that works on in-memory synthetic data, with `expect(name, bool)` assertions and a final line like `SELF-TEST OK (N cases)`.
- Output goes to `private/deploy-out/` (gitignored).

Behavior:
- Read `us-journey-tracker.html`.
- Insert `<script>window.USJ_CONFIG={backend:'pocketbase'}</script>` (the `readConfig()` input at `us-journey-tracker.html:881-884`).
- Compute sha256 for every inline `<script>` and `<style>`, and emit `usj-csp.conf` with `'sha256-…'` entries.
- The generated `style="width:${pct}%"` attributes need `style-src-attr 'unsafe-inline'` (CSP3), or a documented compromise. Research decides.
- Substitute `__BUILD_VERSION__` in `sw.js`.
- Write `SHA256SUMS`.

Constraint: the repo `us-journey-tracker.html` is never modified by the build, so `APP_SHA256` still pins the repo file.

### `deploy/verify-site.mjs`

**Analog:** `tools/probe/verify-site.mjs` (copy the structure and rewrite the checks).

Copy:
- `--stage` and `--self-test` modes.
- `PASS <id> <中文说明>` or `FAIL <id> ...` lines, and a final `VERIFY OK (N checks)` or `VERIFY FAIL (k of N)`.
- Domain and IP read at runtime from `private/server.env` (`USJ_DOMAIN`, `USJ_IP`), never in source.
- Errors print only the class name or `code` (not `message`, which can carry hostnames).
- Exit codes: 0 pass, 1 fail, 2 missing env or bad args.
- Piped through `node tools/privacy/redact.mjs`.

Changes:
- F-checks verify the app site: CSP hash matches build output, `/sw.js` has `no-cache`, the manifest content type, icons return 200, SSE, isolation spot-check, and 429 on bad passwords.
- Remove the probe-account checks and the "writes verify- records" side effect.

### `deploy/README.md`

**Analog:** `tools/probe/README.md` (Chinese runbook style). It must say: placeholders only; the sha256 manifest approval flow (06-08-SUMMARY); the risk that the mailbox authorization code lives on the server and how to rotate it (D-02); and R2 keys are entered by the owner.

### `us-journey-tracker.html` edits

Analogs are in the same file:
- Update banner: reuse the `.syncbar` pattern (CSS at line 369-372: `.syncbar[data-tone="info"]`, `.sb-msg`), per 09-UI-SPEC. Check that no inline `on*=` handler is added (CSP).
- Do not touch `readConfig()` (lines 881-886):
```js
function readConfig(){
  try{const c=window.USJ_CONFIG;if(c&&typeof c==="object"&&c.backend!=null)return {backend:c.backend}}catch(e){}
  return {backend:null};
}
```
- The SW registration must only run when `CLOUD` is true. Otherwise the v1 tests (`serviceWorkers: 'block'`, V1 allow list) see extra requests.
- Draft check before the update click: reuse the existing `confirm()` or `dialog#confirm` path.
- Any edit changes the file hash: update `APP_SHA256` in the same commit. The file is LF-only per `.gitattributes`.

### Test files

**`tests/support/constants.ts:38`** `export const APP_SHA256 = '…'`. Update in the same commit as any page edit.

**`tests/support/test.ts:58-61`**
```ts
export const V1_APP_PATHS = ['/', '/us-journey-tracker.html'];
export const CLOUD_APP_PATHS = ['/', '/us-journey-tracker.html', PB_SDK_PATH];
```
- Add `/manifest.webmanifest` and the icon paths to both lists, because the link tags load in every mode.
- Add `/sw.js` only to the cloud list (research Pitfall).
- Every entry needs a reason comment, as the file requires.

**`tests/support/static-server.cjs`:** it serves a whitelist only (`APP_FILE`, SDK path from `tools/probe/page/vendor/`), 404 otherwise, and pins the SDK sha256 at startup. Extend the whitelist for the manifest, icons and `sw.js` (with a fixed version replacing `__BUILD_VERSION__`). Keep serving icons from `deploy/site/`; do not copy a second set.

**`playwright.config.ts:53` and `playwright.cloud.config.ts`:** `serviceWorkers: 'block'` stays the default. The offline cold-start spec opens its own context with `serviceWorkers: 'allow'` (a new `browser.newContext`, as the second-device contexts already do). Single worker; no concurrency.

**Offline spec:** use the `app-variant.ts` pattern of `page.route` serving a modified page only to one page (`serveAppVariant`, `AppEdit {find, replace}` replaced exactly once). Here the use is to inject the `USJ_CONFIG` line and the SW registration variant without touching disk. Imports only from `@playwright/test`, node built-ins and `./constants`.

### `.gitattributes`

Existing rules: `*.sh text eol=lf`, `tools/probe/** text eol=lf`, `pb/** text eol=lf`, and `tools/probe/page/vendor/** -text`. Add:
```
deploy/** text eol=lf
deploy/site/icons/** -text
```
PNGs must be binary (`-text`). Since `deploy/**` (for `.sh`, `.service`, `.conf`, `.js`, `.mjs`, `.webmanifest`) is copied to Linux, LF-only applies to all non-PNG files. Put the `-text` line after the `deploy/**` line so it overrides it.

## Shared Patterns

### Server script conventions (all `deploy/server/*.sh`)
**Source:** `tools/probe/server/04-start-pocketbase.sh`, `05-nginx-probe.sh`
- `#!/usr/bin/env bash` and `set -euo pipefail`; never `set -x`.
- Chinese header comment with sections for prerequisites, what changes, outputs and rollback.
- `sudo -n` everywhere. Add `</dev/null` to any command that may read stdin. Python runs via heredoc with `python3 -I`.
- Output is `KEY=VALUE` lines only. Never echo a password or token. Messages that could carry a hostname go through `redact.mjs` on the local side.
- Missing upload files: `错误：缺少上传的文件 …` and exit 1.
- Approval flow: sha256 manifest, owner approval, upload to a temp dir, verify the hash three times, execute.

### Privacy (every new tracked file)
**Source:** `PRIVACY.md` rules A-H; `tools/privacy/privacy-check.mjs`
- Placeholders only: no domain, IP, e-mail, key, token, `pb_data`, `.db`, archives, or a PocketBase binary in the tracked tree.
- Rule G keywords: `password`, `secret`, `encryption_key`, `api_key`, `access_key`, `private_key`. A value after these must be a placeholder such as `<...>`, `$VAR`, `change_me`, `...`, or shorter than 6 characters. In `deploy/` use `PB_ENCRYPTION_KEY=$VAR` or read from an env file; `Environment=KEY=value` is blocked.
- Rule H: no public IPv4. Use `192.0.2.x` or `203.0.113.x` in docs.
- Rule B: no local absolute paths, so write repo-relative paths only (including in this file).
- Rule C: no real e-mail (use `example.com`).
- Rule F: no JWT shape (`eyJ…` three segments).
- The domain and IP live only in `private/server.env` (`USJ_DOMAIN`, `USJ_IP`) and `private/denylist.txt`, handled by `tools/privacy/redact.mjs` (`--init-env`, `--verify-env`, `--self-test`).

### Self-test CLI pattern (all new `.mjs`)
**Source:** `tools/plan/migrate-backup.mjs:10,235,350,476`, `tools/probe/verify-site.mjs` header
- Zero dependencies, `node:` built-ins only.
- `--self-test` runs on in-memory synthetic data and does not read `private/`.
- `expect(name, cond)` assertions; the final line is `SELF-TEST OK (N cases)`.
- Distinct exit codes (0 / 1 / 2), and a printed usage string on bad args.

### LF-only files per `.gitattributes`
Currently covered: `*.sh`, `.githooks/**`, `us-journey-tracker.html`, `tools/probe/**`, `pb/**`. New `deploy/**` is not yet covered (see the `.gitattributes` entry above). The `.mjs` files under `tools/` outside `tools/probe/` are not forced LF today.

## No Analog Found

| File | Role | Data Flow | Reason / Where to take the pattern |
|---|---|---|---|
| `deploy/site/sw.js` | service worker | event-driven | No SW in repo. Use 13-RESEARCH Pattern (lines ~285-335): precache `SHELL`, `respondWith` only for `/`, `/index.html` and `SHELL` paths, never `/api/*`, `/_/*` or `/sw.js`; `SKIP_WAITING` message; versioned cache name. |
| `deploy/site/manifest.webmanifest` and `icons/*.png` | asset | static | Research §8. |
| `deploy/pb_hooks/backup-watch.pb.js` | hook | event-driven | No `pb_hooks` exist. Research lines ~453-480. |
| `deploy/server/logrotate/usj-nginx` | config | batch | Research §4. |
| `deploy/server/restore-drill.sh`, `pb-admin.sh`, `07-retire-probe.sh` | server script | batch | Only the conventions above apply. Content per research §5 and the pb-admin description (reads `/etc/usj/pocketbase.env` from a `root:pocketbase` file with restricted mode). Passwords are typed on site by the owner, never stored. |
| `deploy/make-icons.mjs` | script | file-I/O | Uses Playwright with local Edge (`channel: 'msedge'`, no browser download). Run once, commit the PNGs. |

## Metadata

**Analog search scope:** `tools/probe/server/`, `tools/probe/`, `tools/pb/`, `tools/plan/`, `tools/privacy/`, `pb/`, `tests/support/`, root configs, `us-journey-tracker.html`, `.gitattributes`, `PRIVACY.md`
**Files scanned:** about 20 read or excerpted. `06-install-probe-page.sh`, `02/03` scripts and `tools/probe/README.md` were identified but not fully read.
**Pattern extraction date:** 2026-11-11
