import { useState } from 'react';
import type { Backup } from '../lib/backup';
import { parseBackup } from '../lib/backup';
import { isDesktop, nativeCommand } from '../lib/desktop';

export default function DataTransfer({ backup, onRestore }: { backup: Backup; onRestore: (backup: Backup) => void }) {
  const [selected, setSelected] = useState<Backup | null>(null);
  const [status, setStatus] = useState('');
  const exportData = async () => {
    try {
      const data = JSON.stringify(backup, null, 2);
      if (isDesktop()) {
        const saved = await nativeCommand<boolean>('save_backup', { data });
        setStatus(saved ? 'Backup saved.' : 'Export canceled.');
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'habit-forge-backup.json'; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('Backup exported.');
      }
    } catch { setStatus('Could not export backup.'); }
  };
  return <section className="card">
    <h2>Backup and restore</h2>
    <button onClick={exportData}>Export backup</button>
    <label className="file-label">Import backup
      <input type="file" accept=".json,application/json" onChange={async event => {
        setSelected(null); setStatus('');
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          if (file.size > 5_000_000) throw new Error('Backup exceeds the 5 MB limit.');
          setSelected(parseBackup(await file.text()));
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not read backup.'); }
        event.target.value = '';
      }} />
    </label>
    {selected && <div>
      <p>{selected.habits.length} habits and {selected.events.length} completion events. Restoring replaces current data after saving a recovery copy.</p>
      <button onClick={() => {
        try { onRestore(selected); setSelected(null); setStatus('Backup restored.'); }
        catch { setStatus('Restore failed. Original data was preserved; check available storage space.'); }
      }}>Restore backup</button>
    </div>}
    {status && <p role="status">{status}</p>}
  </section>;
}
