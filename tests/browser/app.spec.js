import { test, expect, habit, settings, seed, openApp, ruleCount, stored } from './fixtures.js';

const blocked = 'http://blocked.habit-forge.test:4180/';
const destination = 'http://habit.habit-forge.test:4180/';
const routine = page => page.locator('.habit').first();

test('fresh settings sync with enforcement off and keep private fields in the app', async ({ page, worker }) => {
  await seed(page);
  await openApp(page);
  expect(await ruleCount(worker)).toBe(0);
  const snapshot = await worker.evaluate(async () => (await chrome.storage.local.get('habitForgeState')).habitForgeState);
  expect(snapshot.habits).toHaveLength(1);
  expect(snapshot.habits[0]).not.toHaveProperty('description');
  expect(snapshot.habits[0]).not.toHaveProperty('verificationUsername');
  expect(await worker.evaluate(async () => Boolean(await chrome.alarms.get('habit-forge-tick')))).toBe(true);
});

test('real navigation is blocked by domain and unlocked after completion', async ({ page, context, worker }) => {
  await seed(page, { 'habit-forge-settings': JSON.stringify(settings({ blockingEnabled: true })) });
  await openApp(page);
  await expect.poll(() => ruleCount(worker)).toBe(1);
  // Chrome can still be committing its error page after goto rejects.
  // Close each rejected navigation before testing an unrelated destination.
  for (const url of [blocked, 'http://sub.blocked.habit-forge.test:4180/']) {
    const rejected = await context.newPage();
    try { await expect(rejected.goto(url)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/); }
    finally { await rejected.close(); }
  }
  const target = await context.newPage();
  await target.goto(`http://allowed.habit-forge.test:4180/?site=${encodeURIComponent(blocked)}`);
  await expect(target.getByRole('heading', { name: 'Acceptance destination' })).toBeVisible();
  await routine(page).getByRole('button', { name: 'Complete', exact: true }).click();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  await target.goto(blocked);
  await expect(target.getByRole('heading', { name: 'Acceptance destination' })).toBeVisible();
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(1);
  await page.reload();
  await expect(routine(page).getByRole('button', { name: 'Completed today' })).toBeDisabled();
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(1);
});

test('mandatory habit destinations remain reachable when also on the block list', async ({ page, context, worker }) => {
  await seed(page, { 'habit-forge-settings': JSON.stringify(settings({
    blockingEnabled: true, blockedSites: ['habit.habit-forge.test', 'blocked.habit-forge.test'],
  })) });
  await openApp(page);
  await expect.poll(() => ruleCount(worker)).toBe(2);
  const target = await context.newPage();
  await target.goto(destination);
  await expect(target.getByRole('heading', { name: 'Acceptance destination' })).toBeVisible();
  await expect(target.goto(blocked)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/);
});

test('Exam Mode, Grace Days, and pause each release focus enforcement', async ({ page, worker }) => {
  await seed(page, { 'habit-forge-settings': JSON.stringify(settings({ blockingEnabled: true })) });
  await openApp(page);
  await expect.poll(() => ruleCount(worker)).toBe(1);
  const exam = page.getByRole('checkbox', { name: /^Exam Mode:/ });
  await exam.check();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  await exam.uncheck();
  await expect.poll(() => ruleCount(worker)).toBe(1);
  await routine(page).getByRole('button', { name: 'Use Grace Day' }).click();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
  expect((await stored(page, 'habit-forge-settings')).graceDays).toHaveLength(1);
  await page.reload();
  await expect(routine(page).getByRole('button', { name: 'Remove Grace Day' })).toBeVisible();
  await routine(page).getByRole('button', { name: 'Remove Grace Day' }).click();
  await expect.poll(() => ruleCount(worker)).toBe(1);
  await routine(page).getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  await expect(routine(page).getByRole('button', { name: 'Complete', exact: true })).toBeDisabled();
});

test('due website opens once and remains deduplicated across dashboard reloads', async ({ page, context, worker }) => {
  await seed(page, { 'habit-forge-settings': JSON.stringify(settings({ autoOpen: true })) });
  await openApp(page);
  const matchingTabs = async () => (await worker.evaluate(() => chrome.tabs.query({})))
    .filter(tab => tab.url?.startsWith('http://habit.habit-forge.test:4180')).length;
  await expect.poll(matchingTabs).toBe(1);
  const opened = context.pages().find(tab => tab.url().startsWith('http://habit.habit-forge.test:4180'));
  expect(opened).toBeTruthy();
  await expect(opened.getByRole('heading', { name: 'Acceptance destination' })).toBeVisible();
  for (let index = 0; index < 2; index++) {
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Extension connected' })).toBeVisible();
    expect(await matchingTabs()).toBe(1);
  }
  const ledger = await worker.evaluate(async () => (await chrome.storage.local.get('schedulerLedger')).schedulerLedger);
  expect(ledger.actions['open:habit-1']).toBe(true);
});

test('editing active weekdays immediately removes an off-day habit from enforcement', async ({ page, worker }) => {
  await seed(page, { 'habit-forge-settings': JSON.stringify(settings({ blockingEnabled: true })) });
  await openApp(page);
  await expect.poll(() => ruleCount(worker)).toBe(1);
  const today = await page.evaluate(() => new Date().getDay());
  await routine(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('checkbox', { name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today], exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  await expect(routine(page).getByText('Not scheduled today')).toBeVisible();
  await expect(routine(page).getByRole('button', { name: 'Complete', exact: true })).toBeDisabled();
  await page.reload();
  expect((await stored(page, 'habit-forge'))[0].activeDays).not.toContain(today);
});

test('legacy migration backs up the original and never invents completion events from done flags', async ({ page }) => {
  const legacy = JSON.stringify([{ id: 1, name: 'Walk', time: '00:00', site: '', days: [0, 1, 2, 3, 4, 5, 6], done: true }]);
  await seed(page, { 'habit-forge': legacy });
  await openApp(page);
  expect(await page.evaluate(() => localStorage.getItem('habit-forge-recovery'))).toBe(legacy);
  const records = await stored(page, 'habit-forge');
  expect(records[0].name).toBe('Walk');
  expect(typeof records[0].id).toBe('string');
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
  await expect(routine(page).getByRole('button', { name: 'Complete', exact: true })).toBeEnabled();
});

test('future settings and malformed events remain recoverable before defaults are persisted', async ({ page, worker }) => {
  const future = '{"version":99,"blockingEnabled":true}';
  await seed(page, { 'habit-forge-settings': future, 'habit-forge-completions': 'invalid-json' });
  await openApp(page);
  expect(await page.evaluate(() => localStorage.getItem('habit-forge-settings-recovery'))).toBe(future);
  expect(await page.evaluate(() => localStorage.getItem('habit-forge-completions-recovery'))).toBe('invalid-json');
  expect(await ruleCount(worker)).toBe(0);
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
});

test('GitHub failure awards no credit and successful verification persists its source', async ({ page }) => {
  await seed(page, { 'habit-forge': JSON.stringify([habit({ verificationMethod: 'github', verificationUsername: 'octocat' })]) });
  let limited = true;
  await page.route('https://api.github.com/users/octocat/events/public?*', route => route.fulfill({
    status: limited ? 403 : 200,
    contentType: 'application/json',
    body: JSON.stringify(limited ? { message: 'Rate limit' } : [{ id: 'event-1', type: 'PushEvent', created_at: new Date().toISOString() }]),
  }));
  await openApp(page);
  await routine(page).getByRole('button', { name: 'Verify GitHub' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'rate limit' })).toBeVisible();
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
  limited = false;
  await routine(page).getByRole('button', { name: 'Verify GitHub' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'verified 1 public activities' })).toBeVisible();
  expect((await stored(page, 'habit-forge-completions'))[0].source).toBe('github');
  await page.reload();
  await expect(routine(page).getByRole('button', { name: 'Completed today' })).toBeDisabled();
});

test('dashboard wraps long habit names without document overflow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, { 'habit-forge': JSON.stringify([habit({ name: 'A'.repeat(140), description: 'Notes '.repeat(40) })]) });
  await openApp(page);
  const sizes = testInfo.project.name === 'mobile-viewport' ? [320, 390] : [1280];
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Last 30 days' })).toBeVisible();
    await testInfo.attach(`dashboard-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
  expect(errors).toEqual([]);
});

for (const [provider, label, unit] of [
  ['leetcode', 'LeetCode', 'distinct accepted problems'],
  ['kaggle', 'Kaggle', 'notebooks last run'],
]) {
  test(`${label} verification fails without credit, then records provider evidence after success`, async ({ page, worker }) => {
    await seed(page, { 'habit-forge': JSON.stringify([habit({ verificationMethod: provider, verificationUsername: 'coder', minimumRequirement: 2 })]) });
    let enough = false;
    await page.route('**/api/verify', route => {
      const request = route.request().postDataJSON();
      expect(request.provider).toBe(provider);
      expect(request.username).toBe('coder');
      expect(['Asia/Calcutta', 'Asia/Kolkata']).toContain(request.timeZone);
      return route.fulfill({
        status: enough ? 200 : 422, contentType: 'application/json',
        body: JSON.stringify(enough
          ? { provider, username: 'coder', localDate: request.localDate, count: 2, unit }
          : { error: '1/2 activities found today.' }),
      });
    });
    await openApp(page);
    await routine(page).getByRole('button', { name: `Verify ${label}` }).click();
    await expect(page.getByRole('status').filter({ hasText: '1/2 activities' })).toBeVisible();
    expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
    enough = true;
    await routine(page).getByRole('button', { name: `Verify ${label}` }).click();
    await expect(page.getByRole('status').filter({ hasText: `verified 2 ${unit}` })).toBeVisible();
    const events = await stored(page, 'habit-forge-completions');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe(provider);
    expect(events[0].verification.count).toBe(2);
    expect(events[0].verification.unit).toBe(unit);
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('habitForgeState')).habitForgeState.completions[0]?.source)).toBe(provider);
    await page.reload();
    await expect(routine(page).getByRole('button', { name: 'Completed today' })).toBeDisabled();
    expect(await stored(page, 'habit-forge-completions')).toHaveLength(1);
  });
}

test('Kaggle reports missing local credentials without recording completion', async ({ page }) => {
  await seed(page, { 'habit-forge': JSON.stringify([habit({ verificationMethod: 'kaggle', verificationUsername: 'coder' })]) });
  await openApp(page);
  await routine(page).getByRole('button', { name: 'Verify Kaggle' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Kaggle credentials are not configured' })).toBeVisible();
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
});

test('a habit edited while provider verification is in flight receives no stale credit', async ({ page }) => {
  await seed(page, { 'habit-forge': JSON.stringify([habit({ verificationMethod: 'leetcode', verificationUsername: 'coder' })]) });
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const received = new Promise(resolve => { started = resolve; });
  await page.route('**/api/verify', async route => {
    const request = route.request().postDataJSON();
    started();
    await gate;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      provider: 'leetcode', username: 'coder', localDate: request.localDate, count: 1, unit: 'distinct accepted problems',
    }) });
  });
  await openApp(page);
  await routine(page).getByRole('button', { name: 'Verify LeetCode' }).click();
  await received;
  try {
    await routine(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByPlaceholder('Habit name', { exact: true }).fill('Changed while checking');
    await page.getByRole('button', { name: 'Save changes' }).click();
  } finally { release(); }
  await expect(page.getByRole('status').filter({ hasText: 'Habit or date changed while checking' })).toBeVisible();
  expect(await stored(page, 'habit-forge-completions')).toHaveLength(0);
});

test('desktop pairing protects the selected data source and unpairs back to browser mode', async ({ page, worker, context }, testInfo) => {
  await seed(page);
  await openApp(page);
  const token = (testInfo.project.name === 'desktop' ? 'a' : 'b').repeat(64);
  const snapshot = await stored(page, 'habit-forge-extension-snapshot');
  snapshot.habits[0].id = 'desktop-only';
  snapshot.habits[0].name = 'Desktop habit';
  snapshot.settings.blockingEnabled = true;
  const update = () => page.request.post('http://127.0.0.1:4180/desktop-test-state', { data: { token, snapshot } });
  await update();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${worker.url().split('/')[2]}/popup.html`);
  await popup.getByLabel('Desktop pairing token').fill('c'.repeat(64));
  await popup.getByRole('button', { name: 'Pair desktop', exact: true }).click();
  await expect(popup.getByRole('status').filter({ hasText: 'not accepted' })).toBeVisible();
  await popup.getByLabel('Desktop pairing token').fill(token);
  await popup.getByRole('button', { name: 'Pair desktop', exact: true }).click();
  await expect(popup.getByRole('status').filter({ hasText: 'Desktop paired' })).toBeVisible();
  await expect.poll(() => ruleCount(worker)).toBe(1);
  await routine(page).getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'paired with desktop' })).toBeVisible();
  const state = await worker.evaluate(async () => (await chrome.storage.local.get('habitForgeState')).habitForgeState);
  expect(state.habits[0].id).toBe('desktop-only');
  expect(state.completions).toHaveLength(0);
  snapshot.completions.push({ habitId:'desktop-only', localDate:snapshot.today, completedAt:new Date().toISOString(), source:'manual' });
  await update();
  await popup.getByLabel('Desktop pairing token').fill(token);
  await popup.getByRole('button', { name: 'Pair desktop', exact: true }).click();
  await expect.poll(() => ruleCount(worker)).toBe(0);
  await popup.getByRole('button', { name: 'Use browser dashboard' }).click();
  await expect(popup.getByRole('status').filter({ hasText: 'Browser mode' })).toBeVisible();
  expect(await worker.evaluate(async () => Boolean((await chrome.storage.local.get('desktopToken')).desktopToken))).toBe(false);
});

test('backup import requires explicit restore and retains a recovery copy', async ({ page }) => {
  await seed(page);
  await openApp(page);
  await page.getByLabel('Import backup').setInputFiles({ name:'invalid.json', mimeType:'application/json', buffer:Buffer.from('{"version":99}') });
  await expect(page.getByRole('status').filter({ hasText:'Unsupported or invalid backup' })).toBeVisible();
  await expect(routine(page).getByText('Read', { exact:true })).toBeVisible();
  const backup = { version:1, exportedAt:new Date().toISOString(), habits:[habit({ name:'Imported habit' })], events:[], settings:settings() };
  await page.getByLabel('Import backup').setInputFiles({ name:'backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('button', { name:'Restore backup' })).toBeVisible();
  await expect(routine(page).getByText('Read', { exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Restore backup' }).click();
  await expect(routine(page).getByText('Imported habit', { exact:true })).toBeVisible();
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('habit-forge-before-restore-'));
    return JSON.parse(localStorage.getItem(key));
  });
  expect(JSON.parse(saved['habit-forge'])[0].name).toBe('Read');
  await page.reload();
  await expect(routine(page).getByText('Imported habit', { exact:true })).toBeVisible();
});

test('desktop UI routes verification, snapshots and backup exports through native commands', async ({ page }) => {
  await seed(page, { 'habit-forge':JSON.stringify([habit({ verificationMethod:'leetcode', verificationUsername:'coder' })]) });
  await page.addInitScript(() => {
    window.nativeCalls = [];
    window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
      window.nativeCalls.push({ command, args });
      if (command === 'publish_desktop_snapshot') return { connected:true };
      if (command === 'desktop_pairing_info') return { token:'a'.repeat(64), port:5175 };
      if (command === 'save_backup') return true;
      if (command === 'verify_native') return { ...args.request, count:1, unit:'distinct accepted problems' };
      throw new Error('Unexpected native command');
    } };
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText:'Chrome companion connected' })).toBeVisible();
  await expect(page.getByLabel('Pairing token')).toHaveValue('a'.repeat(64));
  await expect(page.getByRole('heading', { name:'Focus controls' })).toBeVisible();
  await routine(page).getByRole('button', { name:'Verify LeetCode' }).click();
  await expect(page.getByRole('status').filter({ hasText:'verified 1 distinct accepted problems' })).toBeVisible();
  await page.getByRole('button', { name:'Export backup' }).click();
  await expect(page.getByRole('status').filter({ hasText:'Backup saved' })).toBeVisible();
  const calls = await page.evaluate(() => window.nativeCalls);
  expect(calls.some(call => call.command === 'verify_native')).toBe(true);
  const exported = calls.find(call => call.command === 'save_backup').args.data;
  expect(exported.includes('a'.repeat(64))).toBe(false);
  expect(JSON.parse(exported).events[0].source).toBe('leetcode');
});
