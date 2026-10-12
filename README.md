# Habit Forge

Local-first habit dashboard with a Chrome MV3 companion.

## Implemented
- Create, edit, delete, pause and resume habits, with weekday-specific routines.
- Idempotent completion events and current/best scheduled-day streaks.
- Configurable blocked domains. Blocking is opt-in and begins only while a mandatory habit is due and incomplete.
- Opt-in scheduled website opening and reminders, once per habit per local day.
- Exam Mode suspends browser blocking, opening and reminders; it does not create completion credit.
- Grace Days are reversible for today, release enforcement for the habit, and bridge streak gaps without incrementing streaks. There is currently no quota.
- Thirty-day analytics and per-habit totals. Rates use current schedules, not historical schedule revisions.
- Public GitHub verification: each unique push, opened pull request or opened issue counts as one activity toward the habit requirement. Manual completion remains available and is labeled separately.
- Experimental public LeetCode verification for distinct problems accepted today.
- Kaggle notebook verification through a local service with server-only credentials.
- Tauri 2 desktop shell, native provider checks, paired Chrome transport and Windows installer CI.
- Export/restore for moving browser data into desktop, with recovery copies and rollback on failed writes.

## Run and verify
Use Node 24 or newer.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

For LeetCode/Kaggle verification, use `npm run dev:full` instead. It starts the dashboard on port 5173 and the loopback-only verification service on port 5174. The API is proxied through the dashboard origin.

Tests cover migration, completion deduplication, streaks, Grace Days, settings recovery, analytics, domain rules, day rollover, sender validation, scheduler deduplication and provider errors. Web checks run in GitHub Actions.

## Browser acceptance tests
Install Playwright's Chromium browser, then run:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite loads the actual unpacked extension into isolated persistent Chromium profiles. It runs at desktop and mobile viewport sizes with the Asia/Kolkata timezone, using local test destinations and no external provider accounts. Real HTTP navigation verifies domain/subdomain blocking, required-site access, and unlocking after completion; Chrome APIs verify stored state, scheduler tab deduplication and installed alarms. UI cases cover Grace Days, Exam Mode, paused/off-day habits, migration/recovery, provider failures, persistence and layout overflow.

Mobile viewport coverage emulates layout in desktop Chromium, not extension support on Android. GitHub verification responses are mocked; other extension and navigation behavior uses the real browser APIs. Notification rendering and OS delivery are not covered by this suite.

GitHub Actions installs Chromium and runs the browser suite after the engine/build checks. Reports, failure traces and dashboard screenshots are uploaded as the `browser-test-report` artifact. Local tests manage ports 5173 and 4180 and stop their servers afterward. The reserved `*.habit-forge.test` destinations resolve only inside the test browser.

## Browser companion
1. Open Chrome Extensions, enable Developer mode and load the `extension/` directory unpacked.
2. Open the dashboard at `http://localhost:5173` or `http://127.0.0.1:5173`.
3. Confirm the dashboard reports "Extension connected". Enable focus controls explicitly.

Reload the extension after updates; the new version requests declarative blocking and notification permissions. It uses Chrome's declarativeNetRequest API to block main-frame navigation to configured domains and subdomains. It does not inspect page content or request broad host access. Mandatory habit destinations and the local dashboard remain reachable. Already-loaded pages are not forcibly closed.

The alarm runs once per minute while Chrome is running. On wake/restart it catches up on today's due habits, not previous days. Browser alarms are not exact-time delivery guarantees. Completion state is recalculated from dated events, including when the dashboard is closed across midnight. Browser timezone determines the local schedule.

Tabs open in the background. Action intent is persisted before opening to prevent repeated tabs after worker restarts; a crash between saving intent and executing it can skip that day's action. Ordinary API failures clear the intent for retry. Extension errors are stored under `habitForgeError` and reported on the next dashboard sync. Disable the extension to immediately remove its enforcement.

State only syncs from the local browser dashboard. The local origin is a trusted boundary: do not run untrusted applications on the same localhost origin. Different ports/browsers maintain separate dashboard storage; use one consistently.

## GitHub verification
Set the habit's GitHub username, choose GitHub verification and click "Verify GitHub". Only public events from the latest three API pages are checked. Events can be delayed and unauthenticated API requests can be rate limited. This is not authenticated proof of account ownership, a complete contribution count, or private-repository verification. Verification failures never create completion events. No tokens or credentials are stored.

## LeetCode and Kaggle verification
Select a provider and set its username in the habit editor. Start `npm run dev:full`, then click the habit's Verify button. Manual completion is still available separately. Successful checks persist the provider source plus count, unit and check time; failed or stale checks do not award credit.

LeetCode uses its public GraphQL endpoint's `matchedUser` and `recentAcSubmissionList` queries. This is an undocumented website contract, so the integration is experimental and may stop working if LeetCode changes it or denies access. Only the latest 100 accepted submissions are checked. Repeated submissions for the same problem count once, and only the browser's current local day is credited. Private histories and account ownership are not verified. No LeetCode login cookies are collected.

Kaggle uses the v1 `kernels/list` compatibility API, filtering by owner and notebook type and checking up to three pages of 100 records sorted by latest run. A distinct owned notebook counts when its latest run timestamp falls today in the browser's timezone. This checks run metadata, not successful execution, editing time, competition submissions, or proof of learning. Accessible private notebooks can count if returned by Kaggle. Timezone-free or changed response formats fail closed.

Configure Kaggle credentials only in the local service environment. Use `.env.example` as the template for a git-ignored `.env.local`; set either `KAGGLE_API_TOKEN`, or the legacy pair `KAGGLE_USERNAME` and `KAGGLE_KEY`. Never use a `VITE_` prefix or put secrets in habit fields. Restart `dev:full` after changing credentials. Credentials are neither returned to the dashboard nor exported to the extension. Authenticated Kaggle success still requires testing with your own account.

The service only binds to `127.0.0.1`, accepts fixed provider operations, requires trusted dashboard origins and JSON requests, rejects oversized bodies, and does not expose upstream errors containing request details. It is for a single trusted local user, not public hosting. No credential endpoint or arbitrary URL proxy is provided. For a built dashboard, run `npm run verify:serve` alongside `npm run preview` on port 4173. Browser data does not migrate between dashboard origins.

Provider contracts: [Kaggle authentication](https://github.com/Kaggle/kaggle-cli/blob/main/skills/references/auth.md), [v1 notebook-list parameters](https://github.com/Kaggle/kaggle-cli/blob/1.5.16/kaggle/api/kaggle_api.py), and [v1 notebook run fields](https://github.com/Kaggle/kaggle-cli/blob/1.5.16/kaggle/api/kaggle_api_extended.py). LeetCode's public endpoint was probed read-only during implementation; there is no official public API contract to cite for that query.

## Data and migration
Existing habit and completion keys are retained. New settings use a versioned, separate key with enforcement disabled by default. Legacy habit migration backs up raw data before rewriting; malformed or unknown habit/event/settings data has recovery keys. Old manual/GitHub events remain valid; new events use additive `leetcode`/`kaggle` sources with optional verification evidence. Private habit descriptions, provider usernames and evidence details are not exported to the extension. Browser localStorage is not cloud backup.

## Desktop shell
Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system, then:

```bash
npm run desktop:dev
npm run desktop:build
```

The shell embeds the dashboard and uses its own webview storage. LeetCode/Kaggle requests use native Rust commands with the same activity definitions as the browser service. Node is not required at runtime. Kaggle credentials come from `KAGGLE_API_TOKEN` or `KAGGLE_USERNAME`/`KAGGLE_KEY` in the environment inherited by the desktop process; `.env.local` is only loaded by the Node browser service. GitHub uses the existing public API check. No account tokens are exposed through the webview.

To enable browser focus controls from desktop:

1. Load the updated unpacked Chrome extension.
2. Copy the pairing token from the desktop app's Chrome companion panel.
3. Open the extension menu, paste the token and select Pair desktop.

The companion reads a token-authenticated snapshot from `127.0.0.1:5175` once per minute. Tokens are generated once in the desktop app-data directory, outside backups; on Unix the token file is created with mode 0600. The bridge is read-only, checks Host and Authorization headers, and sends only the minimal companion snapshot. Browser dashboard sync cannot overwrite desktop state while paired. Select Use browser dashboard in the extension menu to unpair and immediately clear desktop enforcement. Pairing does not merge the two data stores.

Chrome remains responsible for website blocking, browser opening and notifications. It must be running for those features. If desktop closes, Chrome retains the last accepted snapshot and continues evaluating dated events and schedules; reopen desktop to record completion or unpair to release enforcement. Desktop does not provide OS-wide website blocking, an independent background scheduler, or native notifications.

Use Export backup in the browser and Import backup in desktop to migrate your records. Imports validate the schema and show a preview before Restore backup replaces data. A raw recovery copy is saved under `habit-forge-before-restore-*` before writes; failed writes roll back existing data. Unknown schema versions and duplicates are rejected. Desktop export uses a native save dialog. Neither pairing tokens nor provider credentials are included.

The Desktop checks workflow tests the native bridge/provider parsers on Linux, builds the Windows NSIS installer, launches the built executable to verify renderer IPC and authenticated snapshot delivery, and uploads a `windows-installer` artifact. Native dependencies are pinned in `src-tauri/Cargo.lock`. These are development installers without signing or automatic updates. Installer installation and interactive OS testing on a real Windows machine, live authenticated Kaggle checks, Linux/macOS bundles and signing remain release work.

## Remaining release work
- Authenticated Kaggle acceptance testing with a configured account; live LeetCode activity checks and monitoring for upstream contract changes.
- Windows installer install/launch acceptance, signing, updates and Linux/macOS bundles.
- Manual review of desktop/mobile screenshots and OS notification delivery.
- Historical schedule/pause tracking for historically accurate analytics.

