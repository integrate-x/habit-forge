import { test as base, chromium, expect } from '@playwright/test';
import path from 'node:path';

export const test = base.extend({
  context: async ({ viewport, baseURL }, use) => {
    const extension = path.resolve('extension');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      viewport,
      timezoneId: 'Asia/Kolkata',
      baseURL,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
        '--host-resolver-rules=MAP *.habit-forge.test 127.0.0.1',
        '--no-proxy-server',
      ],
    });
    try { await use(context); }
    finally { await context.close(); }
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await use(worker);
  },
});

export { expect };

export function habit(overrides = {}) {
  return {
    id: 'habit-1', name: 'Read', description: 'Private habit notes',
    category: 'learning', minimumRequirement: 1,
    website: 'http://habit.habit-forge.test:4180', scheduledTime: '00:00',
    activeDays: [0, 1, 2, 3, 4, 5, 6], mandatory: true,
    verificationMethod: 'manual', verificationUsername: 'private-username', paused: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function settings(overrides = {}) {
  return {
    version: 1, blockedSites: ['blocked.habit-forge.test'], blockingEnabled: false,
    autoOpen: false, notifications: false, examMode: false, graceDays: [],
    ...overrides,
  };
}

export async function seed(page, overrides = {}) {
  const data = {
    'habit-forge': JSON.stringify([habit()]),
    'habit-forge-initialized': 'true',
    'habit-forge-completions': '[]',
    'habit-forge-settings': JSON.stringify(settings()),
    ...overrides,
  };
  await page.addInitScript(values => {
    if (location.origin !== 'http://127.0.0.1:5173' || localStorage.getItem('browser-tests-seeded')) return;
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    localStorage.setItem('browser-tests-seeded', 'true');
  }, data);
}

export async function openApp(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Habit Forge', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Extension connected' })).toBeVisible();
}

export async function ruleCount(worker) {
  return worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length);
}

export async function stored(page, key) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}
