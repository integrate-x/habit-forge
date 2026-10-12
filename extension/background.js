const STATE_KEY = 'habitForgeState';

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSnapshot(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.version === 1 &&
    isString(value.exportedAt) &&
    !Number.isNaN(Date.parse(value.exportedAt)) &&
    isDateKey(value.today) &&
    Array.isArray(value.habits) &&
    Array.isArray(value.completions) &&
    value.habits.every((habit) =>
      habit &&
      typeof habit === 'object' &&
      isString(habit.id) &&
      isString(habit.name) &&
      isString(habit.website) &&
      isString(habit.scheduledTime) &&
      Array.isArray(habit.activeDays) &&
      habit.activeDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
      typeof habit.mandatory === 'boolean' &&
      typeof habit.paused === 'boolean' &&
      isString(habit.verificationMethod) &&
      typeof habit.completedToday === 'boolean' &&
      isNumber(habit.currentStreak) &&
      isNumber(habit.longestStreak),
    ) &&
    value.completions.every((event) =>
      event &&
      typeof event === 'object' &&
      isString(event.habitId) &&
      isString(event.completedAt) &&
      !Number.isNaN(Date.parse(event.completedAt)) &&
      isDateKey(event.localDate) &&
      event.source === 'manual',
    )
  );
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('habit-forge-tick', { periodInMinutes: 1 });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'HABIT_FORGE_STATE') return false;

  if (!isSnapshot(message.payload)) {
    sendResponse({ ok: false, error: 'Invalid Habit Forge state snapshot' });
    return false;
  }

  chrome.storage.local.set(
    {
      [STATE_KEY]: {
        ...message.payload,
        receivedAt: new Date().toISOString(),
      },
    },
    () => {
      const error = chrome.runtime.lastError?.message;
      sendResponse(error ? { ok: false, error } : { ok: true });
    },
  );

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'habit-forge-tick') return;

  chrome.storage.local.get(STATE_KEY, (result) => {
    const state = result[STATE_KEY];
    if (!state) return;

    const dueHabits = state.habits.filter((habit) =>
      habit.mandatory &&
      !habit.paused &&
      !habit.completedToday &&
      habit.website,
    );

    console.log('Habit Forge scheduler tick', {
      syncedAt: state.receivedAt,
      dueHabitCount: dueHabits.length,
    });
  });
});
