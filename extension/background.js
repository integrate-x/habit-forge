import { blockingRules, dateKey, dueHabits, isSnapshot, safeWebsite } from './policy.js';
import { readDesktopSnapshot } from './desktop.js';

const STATE_KEY = 'habitForgeState';
let queue = Promise.resolve();
function enqueue(task) {
  const job = queue.then(task);
  queue = job.catch(async error => {
    console.error('Habit Forge', error);
    await chrome.storage.local.set({ habitForgeError: String(error.message || error) });
  });
  return job;
}

async function tick() {
  const data = await chrome.storage.local.get([STATE_KEY, 'schedulerLedger', 'desktopToken']);
  let desktopError;
  if (data.desktopToken) {
    try {
      data[STATE_KEY] = { ...await readDesktopSnapshot(data.desktopToken), receivedAt: new Date().toISOString() };
      await chrome.storage.local.set({ [STATE_KEY]: data[STATE_KEY] });
    } catch (error) { desktopError = error.message; }
  }
  const state = isSnapshot(data[STATE_KEY]) ? data[STATE_KEY] : null;
  const now = new Date();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(rule => rule.id), addRules: blockingRules(state, now),
  });
  const today = dateKey(now);
  const ledger = data.schedulerLedger?.date === today ? data.schedulerLedger : { date: today, actions: {} };
  for (const habit of dueHabits(state, now)) {
    const url = safeWebsite(habit.website);
    for (const action of ['open', 'notify']) {
      if ((action === 'open' && (!state.settings?.autoOpen || !url)) ||
        (action === 'notify' && !state.settings?.notifications)) continue;
      const key = `${action}:${habit.id}`;
      if (ledger.actions[key]) continue;
      // Persist intent first so a worker restart cannot repeatedly open tabs.
      ledger.actions[key] = true;
      await chrome.storage.local.set({ schedulerLedger: ledger });
      try {
        if (action === 'open') await chrome.tabs.create({ url, active: false });
        else await chrome.notifications.create(`habit:${habit.id}`, {
          type: 'basic', iconUrl: 'icon.png', title: 'Habit Forge', message: `${habit.name} is due`,
        });
      } catch (error) {
        delete ledger.actions[key];
        await chrome.storage.local.set({ schedulerLedger: ledger });
        throw error;
      }
    }
  }
  if (desktopError) await chrome.storage.local.set({ habitForgeError: desktopError });
  else await chrome.storage.local.remove('habitForgeError');
}

async function start() {
  await chrome.alarms.create('habit-forge-tick', { periodInMinutes: 1 });
  await tick();
}
chrome.runtime.onInstalled.addListener(() => { void enqueue(start); });
chrome.runtime.onStartup.addListener(() => { void enqueue(start); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'habit-forge-tick') void enqueue(tick);
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const fromPopup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html');
  if (message?.type === 'HABIT_FORGE_PAIR' || message?.type === 'HABIT_FORGE_UNPAIR') {
    if (!fromPopup) { respond({ ok: false, error: 'Untrusted pairing request.' }); return false; }
    enqueue(async () => {
      if (message.type === 'HABIT_FORGE_PAIR') {
        const snapshot = await readDesktopSnapshot(message.token);
        await chrome.storage.local.set({ desktopToken: message.token, [STATE_KEY]: snapshot });
      } else await chrome.storage.local.remove(['desktopToken', STATE_KEY]);
      await tick();
    }).then(() => respond({ ok: true }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type !== 'HABIT_FORGE_STATE') return false;
  const url = safeWebsite(sender.url || '');
  if (sender.id !== chrome.runtime.id || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
    new URL(url).protocol !== 'http:' || !isSnapshot(message.payload)) {
    respond({ ok: false, error: 'Untrusted sender or invalid snapshot' });
    return false;
  }
  enqueue(async () => {
    const data = await chrome.storage.local.get('desktopToken');
    if (data.desktopToken) throw new Error('Companion is paired with desktop. Switch to browser mode in the extension menu.');
    await chrome.storage.local.set({ [STATE_KEY]: { ...message.payload, receivedAt: new Date().toISOString() } });
    await tick();
  }).then(() => respond({ ok: true }), error => respond({ ok: false, error: String(error.message || error) }));
  return true;
});


