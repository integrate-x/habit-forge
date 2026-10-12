export function dateKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function safeWebsite(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function domain(value) {
  const url = safeWebsite(value.includes('://') ? value : `https://${value}`);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return host.includes('.') && host !== '127.0.0.1' && !host.endsWith('.localhost') &&
    /^[a-z0-9.-]+$/.test(host) && host.split('.').every(part => part && !part.startsWith('-') && !part.endsWith('-')) ? host : null;
}

export function isSnapshot(state) {
  if (!state || state.version !== 1 || !Number.isFinite(Date.parse(state.exportedAt)) ||
    !Array.isArray(state.habits) || !Array.isArray(state.completions)) return false;
  const settings = state.settings;
  return (!settings || (settings.version === 1 &&
    ['blockingEnabled', 'autoOpen', 'notifications', 'examMode'].every(key => typeof settings[key] === 'boolean') &&
    Array.isArray(settings.blockedSites) && settings.blockedSites.length <= 100 &&
    settings.blockedSites.every(site => typeof site === 'string' && domain(site) === site) &&
    Array.isArray(settings.graceDays) && settings.graceDays.every(day => day && typeof day.habitId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.localDate)))) &&
    state.habits.every(habit => habit && typeof habit.id === 'string' && typeof habit.name === 'string' &&
      typeof habit.website === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(habit.scheduledTime) &&
      typeof habit.mandatory === 'boolean' && typeof habit.paused === 'boolean' &&
      Array.isArray(habit.activeDays) && habit.activeDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) &&
    state.completions.every(event => event && typeof event.habitId === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(event.localDate));
}

export function dueHabits(state, now = new Date()) {
  if (!state || state.settings?.examMode) return [];
  const today = dateKey(now);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return state.habits.filter(habit => !habit.paused && habit.activeDays.includes(now.getDay()) &&
    habit.scheduledTime <= time &&
    !state.completions.some(event => event.habitId === habit.id && event.localDate === today) &&
    !state.settings?.graceDays.some(day => day.habitId === habit.id && day.localDate === today));
}

export function blockingRules(state, now = new Date()) {
  if (!state?.settings?.blockingEnabled || !dueHabits(state, now).some(habit => habit.mandatory)) return [];
  const due = dueHabits(state, now);
  // Required habit destinations remain reachable even if their domain is on the block list.
  const allowed = [...new Set(due.filter(habit => habit.mandatory).map(habit => domain(habit.website)).filter(Boolean))];
  return [...new Set(state.settings.blockedSites)].map((host, index) => ({
    id: index + 1, priority: 1, action: { type: 'block' },
    condition: { requestDomains: [host], excludedRequestDomains: ['localhost', '127.0.0.1', ...allowed], resourceTypes: ['main_frame'] },
  }));
}
