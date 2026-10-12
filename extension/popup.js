const status = document.querySelector('#result');
async function refresh() {
  const data = await chrome.storage.local.get(['desktopToken', 'habitForgeError']);
  document.querySelector('#mode').textContent = data.desktopToken ? 'Desktop mode' : 'Browser mode';
  status.textContent = data.habitForgeError || '';
}
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Companion update failed.');
}
document.querySelector('#pair').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await send({ type: 'HABIT_FORGE_PAIR', token: document.querySelector('#token').value.trim() });
    document.querySelector('#token').value = '';
    await refresh();
    status.textContent = 'Desktop paired. Sync occurs once per minute.';
  } catch (error) { status.textContent = error.message; }
});
document.querySelector('#browser').addEventListener('click', async () => {
  try {
    await send({ type: 'HABIT_FORGE_UNPAIR' });
    await chrome.tabs.create({ url: 'http://localhost:5173' });
    await refresh();
  } catch (error) { status.textContent = error.message; }
});
void refresh();
