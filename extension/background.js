import { blockingRules, dateKey, dueHabits, isSnapshot, safeWebsite } from './policy.js';

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
  const data = await chrome.storage.local.get([STATE_KEY, 'schedulerLedger']);
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
  await chrome.storage.local.remove('habitForgeError');
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
  if (message?.type !== 'HABIT_FORGE_STATE') return false;
  const url = safeWebsite(sender.url || '');
  if (sender.id !== chrome.runtime.id || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
    new URL(url).protocol !== 'http:' || !isSnapshot(message.payload)) {
    respond({ ok: false, error: 'Untrusted sender or invalid snapshot' });
    return false;
  }
  enqueue(async () => {
    await chrome.storage.local.set({ [STATE_KEY]: { ...message.payload, receivedAt: new Date().toISOString() } });
    await tick();
  }).then(() => respond({ ok: true }), error => respond({ ok: false, error: String(error.message || error) }));
  return true;
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: 'http://localhost:5173' });
});

