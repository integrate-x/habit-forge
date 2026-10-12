const SNAPSHOT_KEY = 'habit-forge-extension-snapshot';
const STATE_EVENT = 'habit-forge:state';

function parseSnapshot(raw) {
  if (!raw || typeof raw !== 'string') return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sendSnapshot(raw) {
  const payload = parseSnapshot(raw);
  if (!payload) return;

  chrome.runtime.sendMessage(
    { type: 'HABIT_FORGE_STATE', payload },
    () => {
      // The background worker may be restarting; ignore transient delivery errors.
      void chrome.runtime.lastError;
    },
  );
}

window.addEventListener(STATE_EVENT, (event) => {
  sendSnapshot(event.detail);
});

sendSnapshot(window.localStorage.getItem(SNAPSHOT_KEY));
