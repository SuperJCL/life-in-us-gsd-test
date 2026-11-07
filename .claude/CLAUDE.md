<!-- GSD:project-start source:PROJECT.md -->

## Project

**在美国的日子 — 本地测试实验**

「在美国的日子」是一个从 Claude Artifact 导出的个人单文件网页应用（`us-journey-tracker.html`），用来每天记录语言、专业、健身、求职方面的进展，有本周、日历、目标、时间线四个视图。本项目是一次 **GSD 工作流学习实验**：在本地副本上为它搭建 Playwright 浏览器测试环境和 Claude Artifact API（`db` / `user` / `downloads`）的 mock，用合成数据验证现有功能。原托管的 Claude Artifact 始终保持不动。

**v1.0（2026-11-05 交付）：** 本地测试环境已完成，`npm test` 一条命令跑 154 条用例，覆盖四个视图、导入导出和窄屏布局。

**v2.0（进行中）：** 把它做成 3 个人各自登录的网页应用。数据存在用户自己的云服务器上（PocketBase），手机和电脑实时同步，中国和美国都能访问。原 Claude Artifact 仍然不动。

**Core Value:** 3 个人各自在手机和电脑上随时记一笔：记录按账号隔离、不会丢失，并且在设备之间实时同步，中国和美国都能访问。

（v1.0 的核心价值是：不改应用、不接触真实数据，一条命令自动验证四个视图。这套测试在 v2.0 继续当回归防线。）

### Constraints

- **应用源码**：v2.0 可以修改 `us-journey-tracker.html`，但四个视图的界面和操作方式不变，只加登录、编辑计划和服务器存储 — 用户选择保留现有界面
- **托管 Artifact**：不访问、不修改、不发布 — 原应用只存在于 claude.ai 上
- **数据**：真实数据只存在用户自己的服务器上；测试仍然只用合成数据，不连接真实服务器 — 隐私
- **技术栈**：前端保持原生 HTML/JS，不引入 React、Next.js；后端倾向 PocketBase（以调研结论为准）；测试用 Playwright Test — 用户明确要求
- **部署**：腾讯云 Lighthouse 香港（不需要 ICP 备案，先买 1 个月实测），Porkbun 域名，都由用户本人购买；HTTPS 证书自动申请和续期 — 中美都能访问
- **费用**：服务器大约每月 4–8 美元，域名大约每年 10 美元 — 用户要便宜
- **账号和付款**：服务器、域名的购买和注册由用户本人完成；Claude 不代为注册、付款或输入密码
- **安装**：本机只装项目内的 npm devDependency，用本机 Edge，不下载浏览器；服务器上的安装由部署脚本完成，执行前经用户批准
- **网络**：测试运行时拦截所有外部请求 — 结果可重复，不碰线上服务
- **隐私**：公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字；应用程序在去掉个人计划之后才能进仓库
- **资源**：本机测试低优先级、单 worker、不并发 — 用户的电脑容易卡
- **流程**：生成需求和路线图后停下，等用户批准再执行 — 用户明确要求
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- HTML5 + CSS3 + JavaScript (ES2019 baseline: `Object.fromEntries`, `async`/`await`, template literals, spread). All three are inline in the single file `us-journey-tracker.html`:
- None.

## Runtime

- A modern evergreen browser. The app needs `<dialog>`/`showModal()`, `localStorage`, `FileReader`, HTML5 drag and drop, `confirm()`, and the CSS features `env(safe-area-inset-*)`, `clamp()` and `color-scheme`.
- **Original host:** the claude.ai Artifact viewer (a framed page). There, `window.claude.use(name)` exists before the script runs. This analysis checked the calls against the platform's runtime contract 0.2.96 type definitions.
- **Local:** open the file directly or serve it from any static file server. There is no server-side code.
- None. There is no `package.json`, lockfile or `node_modules`.

## Frameworks

- None. The app uses plain DOM APIs and renders by assigning template-literal strings to `innerHTML`.
- None (see `TESTING.md`).
- None. There is no bundler, transpiler, linter or formatter.

## Key Dependencies

- **Claude Artifact runtime capabilities** `db`, `user` and `downloads`, reached through `window.claude.use(name)`. All three are optional at runtime, and the app falls back when they are absent (see `INTEGRATIONS.md`).
- **Browser `localStorage`**, key `us-journey-tracker-v1`. This is the fallback persistence and the only persistence when the app runs locally (`us-journey-tracker.html:365-367`).
- **Google Fonts CSS** for `Noto Serif SC` weights 600/800 (`us-journey-tracker.html:7-9`). It is used only for headings and numbers, and falls back to the system fonts `Songti SC`, `STSong` and Georgia.

## Configuration

- No environment variables and no config files.
- All configuration lives in script constants:
- None.

## Platform Requirements

- Any OS with a modern browser.
- Optionally a static server (Node or Python) so the page has a stable `http://localhost:<port>` origin. `localStorage` is scoped per origin, and `file://` origin behaviour differs between browsers.
- The original deployment is a published Claude Artifact. That is **out of scope for this project**: do not modify, republish or read its data.
- This local test project runs the single HTML file in a local browser only.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Short helpers of one to five characters: `$` (getElementById), `pad`, `ymd`, `parse`, `md`, `esc`, `uid`, `kOf`, `lift`, `tstate` (`us-journey-tracker.html:329-346`).
- Renderers are named `render<View>` (`renderWeek`, `renderCal`, `renderDay`, `renderGoals`, `renderTimeline`, `renderAll`).
- Actions use a plain verb: `addLog`, `deleteLog`, `addTask`, `saveLift`, `openEditor`, `openTaskEditor`, `persist`, `flush`.
- Terse names: `wk` (Monday of the visible week), `wsel` (selected day in the week view), `sel` (selected day in the calendar), `view` (calendar month cursor), `dl`, `rvT`, `tt`.
- Constants are UPPER_CASE: `CATS`, `GROUPS`, `LIFTS`, `BUILTIN`, `LEGACY`, `FIT_GOAL`, `WD`, `CK`, `GCAT`.
- Short object keys in config: `n` (name), `k` (key), `p` (priority id), `def`, `cur`, `hist`.
- Persisted category values are **Chinese display names**, not keys.

## Code Style

- Dense, near-minified JavaScript: several statements per line and lines of 200+ characters. Indentation is one space at the top level of the IIFE.
- Semicolons are used throughout. Strings mostly use double quotes. HTML is built with template literals.
- `const` and arrow functions are preferred. `let` is used for mutable module state. There are no classes.
- CSS is compact too: one rule per line, custom properties for every color, and per-category variables `--c`/`--s` set by `.k-*` classes.

## Import Organization

- None. There are no modules. The only external resource is the Google Fonts `<link>`.

## Error Handling

- `try { … } catch (e) {}` around anything optional (capability resolution, `localStorage`, `dataTransfer`).
- The user sees errors as a `toast(message)` or in the status line through `setStatus`.
- Destructive actions offer **undo** through a toast action, for example deleting a log or a preset tag (`us-journey-tracker.html:548-549`, `us-journey-tracker.html:427`).
- Replacing all data on import asks first with a native `confirm()`.

## Logging

- None. The code makes no `console.*` calls.

## Comments

- Section banners only, in the form `/* ---------- saving ---------- */` and `// week`. There are no doc comments or inline explanations.

## Function Design

- Renderers return nothing and write to `innerHTML` of fixed container ids.
- `composer(p, date)` returns an HTML string. `bindComposer(root, p, getDate)` wires it up after insertion.
- Handlers mutate `state`, then call `persist()` and then `renderAll()` (or a narrower renderer) in that order.
- User text is passed through `esc()` before it enters markup.

## Module Design

- One IIFE closure. Nothing is exported, and nothing touches `window` apart from `window.__dl`.
- Accessibility attributes are written inline in the templates (`role`, `aria-label`, `aria-pressed`, `aria-selected`, `tabindex="0"` on clickable non-buttons, plus Enter/Space handlers).

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | Location |
|---|---|---|
| Header | Arrival date input; "day N in the US" or "N days until departure" counter | `us-journey-tracker.html:441-447` |
| Week tab | Per-category counts and goals for the week, 7 day columns of entries, drag an entry to another day, weekly review textarea, composer | `us-journey-tracker.html:449-479` |
| Calendar tab | Month grid with chips for logs, due tasks and done tasks; day panel with composer and lists | `us-journey-tracker.html:481-505` |
| Goals tab | Strength-lift tracker with history; goal groups P1–P7 with checkboxes, due dates, custom tasks and progress bars | `us-journey-tracker.html:507-527` |
| Timeline tab | Reverse-chronological feed grouped by month, filtered by category | `us-journey-tracker.html:529-541` |
| Composer | Category picker, preset tags (add/hide/edit), free-text entry. Instantiated twice: `w` (week) and `c` (calendar) | `us-journey-tracker.html:389-437` |
| Editor dialog | Edit a log's text, category and date, or delete it; edit a completed task's date or un-complete it | `us-journey-tracker.html:556-594` |
| Persistence | Debounced whole-state save behind the `store` adapter | `us-journey-tracker.html:356-379` |
| Export/Import | CSV calendar export, JSON backup, JSON restore | `us-journey-tracker.html:639-658` |
| Toast | Transient message with an optional undo action | `us-journey-tracker.html:660-663` |

## Pattern Overview

- One global mutable `state` object. Handlers mutate it directly, then call `persist()` and `renderAll()`.
- Rendering is idempotent string templating into `innerHTML`. Every change triggers a full re-render of all tabs, including hidden ones.
- Events are handled by delegation on `document` and on tab containers, using `data-*` attributes (`data-edit`, `data-edittask`, `data-dellog`, `data-task`, `data-due`, `data-preset`, …). Some listeners run in the capture phase and use `stopPropagation`.
- Storage sits behind a three-member adapter `{label, load, save}`. This is the only abstraction boundary in the code.
- Derived data (events on a date, weekly counts) is recomputed on each render by scanning `state.logs` and `allTasks()`.

## Layers

| Layer | Contents | Depends on |
|---|---|---|
| Static config | `CATS`, `GROUPS`, `LIFTS` and the other constants | — |
| Pure helpers | date math (`ymd`, `parse`, `addDays`, `monday`, `md`), `esc`, `uid`, `normalize`, `eventsOn`, `presetsFor` | config |
| State + persistence | `state`, `persist`, `flush`, `store`, `init` | helpers, Claude runtime / `localStorage` |
| Views | `render*` functions, `composer`, `presetsHTML` | state, helpers |
| Controllers | event listeners, `bindComposer`, editor, drag and drop, export/import | everything above |

## Data Flow

### Primary Request Path (record an entry)

### Startup / load

### Export

- CSV: build rows from logs, done tasks and due tasks; quote cells with `csvCell`; format dates as `MM/DD/YYYY`; call `window.__dl.save({filename, data})`.
- JSON: `JSON.stringify(state, null, 2)` through the same `save()`.

### Import

- `FileReader.readAsText`, `JSON.parse`, `normalize`, `confirm()`, then **replace** the entire `state`, then `persist()` and `renderAll()`.

## Key Abstractions

- **`state`**: the one source of truth, whose schema is in `INTEGRATIONS.md`.
- **`store` adapter**: `{label: string, load(): Promise<object|null>, save(obj): Promise<void>}`.
- **Task**: a built-in task (positional id `P<n>-<i>` from `GROUPS`) or a custom one (`c-<uid>`). Per-task progress lives separately in `state.tasks[id]`.
- **Log**: a dated free-text entry with a category. Logs are the main user data and grow without bound.
- **Composer instance `p`**: `"w"` or `"c"`. Its UI state is kept in `compCat[p]`, `compEdit[p]` and `compAdding[p]`.

## Entry Points

- `init()` at the end of the IIFE (`us-journey-tracker.html:665`).
- `window` `pagehide` triggers `flush()` (`us-journey-tracker.html:664`).

## Architectural Constraints

- **Single file, no build:** the artifact format required one self-contained HTML file. Any local tooling must keep that file working when opened directly.
- **Optional runtime:** every Claude capability may be `null`, and the app must keep working without them. It already does for `db` and `user`; without `downloads` it loses export.
- **Whole-state persistence:** every save rewrites the entire state, which ties document size to all history (see `CONCERNS.md`).
- **Load once, write blindly:** there is no subscription and no merge, so the last writer wins across tabs and devices.

## Anti-Patterns

### Positional identifiers for built-in tasks

### Full re-render on every change

### Global side channel

## Error Handling

- **Save:** errors are caught in `flush` and shown as "保存失败：<message>" ("save failed") in the status line. There is no retry: `dirty` is cleared before the save starts.
- **Load:** an error falls back to `localStorage` silently. Only the status label changes.
- **Capability resolution:** errors are swallowed (`catch(e){}`).
- **Export:** `declined` is ignored, `rate_limited` shows a "wait" toast, and anything else shows an "export unavailable" toast.
- **Import:** a parse or `normalize` failure shows a "wrong file format" toast.

## Cross-Cutting Concerns

- **Escaping:** most user text goes through `esc()` before going into `innerHTML`. Ids, `group`, `due` and `cur` values do not (see `CONCERNS.md`).
- **Dates:** local `YYYY-MM-DD` strings compared as text. Weeks start on Monday (`monday()`).
- **Accessibility:** ARIA roles and labels on tabs, buttons and entries; `aria-live` on the toast; `:focus-visible` outline; `prefers-reduced-motion` respected. The tabs have no `tabpanel` or arrow-key behaviour.
- **Theming:** CSS custom properties with a dark palette, applied through `prefers-color-scheme` and `[data-theme]`. The UI has no theme toggle.
- **Responsive:** breakpoints at 900, 820, 720 and 560 px. On mobile, calendar chips shrink to dots and the editor becomes a bottom sheet.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
