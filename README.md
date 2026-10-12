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
- Tauri 2 desktop-shell and packaging configuration (native build not yet validated).

## Run and verify
Use Node 24 or newer.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

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

LeetCode and Kaggle choices currently support manual completion only and display that limitation. Their automatic verification integrations remain to be implemented.

## Data and migration
Existing habit and completion keys are retained. New settings use a versioned, separate key with enforcement disabled by default. Legacy habit migration backs up raw data before rewriting; malformed or unknown habit/event/settings data has recovery keys. Old manual events remain valid; verified GitHub events use the additive `github` source. Private habit descriptions and provider usernames are not exported to the extension. Browser localStorage is not cloud backup.

## Desktop shell
Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system, then:

```bash
npm run desktop:dev
npm run desktop:build
```

The shell embeds the dashboard and uses its own webview storage. It does not automatically migrate browser data. Chrome content scripts cannot run in a Tauri webview, so browser focus controls are hidden in the packaged shell. Native scheduling, notifications, browser/desktop state transport, installer verification, signing and distribution still need implementation/testing before a desktop release.

## Remaining release work
- LeetCode/Kaggle verification with explicit account setup and supported provider contracts.
- Native desktop companion integration and tested installers.
- Passing real-browser acceptance results and review of desktop/mobile screenshots before release.
- Historical schedule/pause tracking for historically accurate analytics.

