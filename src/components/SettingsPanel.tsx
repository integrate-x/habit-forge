import { useState } from 'react';
import type { Settings } from '../lib/settings';
import { normalizeDomain } from '../lib/settings';

export default function SettingsPanel({ settings, onChange }: {
  settings: Settings; onChange: (settings: Settings) => void;
}) {
  const [site, setSite] = useState('');
  const [error, setError] = useState('');
  const addSite = () => {
    const host = normalizeDomain(site);
    if (!host) { setError('Enter a valid website domain or HTTP(S) URL.'); return; }
    if (settings.blockedSites.includes(host)) { setError('This domain is already listed.'); return; }
    if (settings.blockedSites.length >= 100) { setError('Maximum 100 blocked domains.'); return; }
    onChange({ ...settings, blockedSites: [...settings.blockedSites, host] });
    setSite(''); setError('');
  };
  return <section className="card">
    <h2>Focus controls</h2>
    <div className="toggles">
      {([
        ['blockingEnabled', 'Block distractions while mandatory habits are overdue'],
        ['autoOpen', 'Open habit websites when due'],
        ['notifications', 'Notify when habits are due'],
        ['examMode', 'Exam Mode: suspend blocking, auto-opening, and reminders'],
      ] as const).map(([key, label]) => <label key={key}>
        <input type="checkbox" checked={settings[key]} onChange={e => onChange({ ...settings, [key]: e.target.checked })} />{label}
      </label>)}
    </div>
    <h3>Blocked websites</h3>
    <form className="row" onSubmit={e => { e.preventDefault(); addSite(); }}>
      <input aria-label="Blocked domain" placeholder="example.com" value={site} onChange={e => setSite(e.target.value)} />
      <button>Add domain</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {!settings.blockedSites.length && <p className="muted">No blocked websites.</p>}
    <ul>{settings.blockedSites.map(host => <li className="row" key={host}>
      <span>{host}</span><button onClick={() => onChange({ ...settings, blockedSites: settings.blockedSites.filter(item => item !== host) })} aria-label={`Remove ${host}`}>Remove</button>
    </li>)}</ul>
  </section>;
}
