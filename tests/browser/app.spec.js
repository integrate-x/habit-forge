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
