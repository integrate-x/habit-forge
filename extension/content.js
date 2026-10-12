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
    response => {
      const error = chrome.runtime.lastError?.message || response?.error;
      window.dispatchEvent(new CustomEvent('habit-forge:bridge-status', {
        detail: error ? `Extension sync failed: ${error}` : 'Extension connected',
      }));
    },
  );
}

window.addEventListener(STATE_EVENT, (event) => {
  sendSnapshot(event.detail);
});

sendSnapshot(window.localStorage.getItem(SNAPSHOT_KEY));

