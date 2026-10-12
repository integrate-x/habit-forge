import { useEffect, useState } from 'react';
import { nativeCommand } from '../lib/desktop';

export default function DesktopPairing() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    let active = true;
    nativeCommand<{ token: string }>('desktop_pairing_info').then(info => {
      if (active) setToken(info.token);
    }).catch(() => { if (active) setStatus('Desktop companion connection is unavailable.'); });
    return () => { active = false; };
  }, []);
  return <section className="card">
    <h2>Chrome companion</h2>
    <p>Open the extension menu and pair with this token. Sync occurs once per minute while Chrome is running.</p>
    <label>Pairing token<input type={show ? 'text' : 'password'} aria-label="Pairing token" readOnly value={token} /></label>
    <button disabled={!token} onClick={() => setShow(current => !current)}>{show ? 'Hide token' : 'Show token'}</button>
    <button disabled={!token} onClick={async () => {
      try { await navigator.clipboard.writeText(token); setStatus('Token copied.'); }
      catch { setStatus('Clipboard unavailable. Use Show token, then select and copy.'); }
    }}>Copy pairing token</button>
    {status && <p role="status">{status}</p>}
  </section>;
}
