import { useEffect, useRef, useState } from 'react';
import type { Habit, CompletionEvent } from '../shared/types';
import HabitForm from './components/HabitForm';
import HabitList from './components/HabitList';
import { loadHabits, saveHabits } from './lib/storage';
import { loadCompletionEvents, saveCompletionEvents } from './lib/completionStorage';
import { recordCompletion, localDateKey } from './lib/completions';
import { publishExtensionSnapshot } from './lib/extensionBridge';
import { loadSettings, saveSettings } from './lib/settings';
import SettingsPanel from './components/SettingsPanel';
import Analytics from './components/Analytics';
import { verifyGitHub } from './lib/verification';
import { verifyProvider } from './lib/providerVerification';

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [events, setEvents] = useState<CompletionEvent[]>(loadCompletionEvents);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [settings, setSettings] = useState(loadSettings);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState('');
  const desktop = '__TAURI_INTERNALS__' in window;
  const [bridgeStatus, setBridgeStatus] = useState(desktop
    ? 'Desktop shell: browser enforcement is only available in the browser companion.'
    : 'Extension not connected');
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const habitsRef = useRef(habits);
  habitsRef.current = habits;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const status = (event: Event) => setBridgeStatus((event as CustomEvent).detail);
    window.addEventListener('habit-forge:bridge-status', status);
    return () => { window.clearInterval(timer); window.removeEventListener('habit-forge:bridge-status', status); };
  }, []);
  useEffect(() => {
    try {
      saveHabits(habits); saveCompletionEvents(events); saveSettings(settings);
      publishExtensionSnapshot(habits, events, settings);
      setError('');
    } catch {
      setError('Could not save data. Check browser storage permissions or available space. Keep this page open until resolved.');
    }
  }, [habits, events, settings, now]);

  const addHabit = (habit: Habit) => setHabits(current => [...current, habit]);
  const updateHabit = (updatedHabit: Habit) => {
    setHabits(current => current.map(habit => habit.id === updatedHabit.id ? updatedHabit : habit));
    setEditingHabit(null);
  };
  const toggleComplete = (id: string) => {
    const habit = habits.find(habit => habit.id === id);
    if (!habit || habit.paused || !habit.activeDays.includes(new Date().getDay())) return;
    setEvents(current => recordCompletion(current, id));
  };
  const toggleGrace = (id: string) => {
    const localDate = localDateKey(new Date());
    setSettings(current => {
      const exists = current.graceDays.some(day => day.habitId === id && day.localDate === localDate);
      return { ...current, graceDays: exists
        ? current.graceDays.filter(day => day.habitId !== id || day.localDate !== localDate)
        : [...current.graceDays, { habitId: id, localDate }] };
    });
  };
  const verifyHabit = async (habit: Habit) => {
    const provider = habit.verificationMethod;
    if (provider === 'manual' || habit.paused || !habit.activeDays.includes(new Date().getDay())) return;
    setVerifying(true);
    setVerificationStatus('');
    const started = new Date();
    try {
      const result = provider === 'github'
        ? { count: await verifyGitHub(habit.verificationUsername || '', habit.minimumRequirement, started), unit: 'public activities' }
        : await verifyProvider(provider, habit.verificationUsername || '', habit.minimumRequirement, started);
      const current = habitsRef.current.find(item => item.id === habit.id);
      const finished = new Date();
      if (!current || current.paused || current.updatedAt !== habit.updatedAt || localDateKey(finished) !== localDateKey(started)) {
        throw new Error('Habit or date changed while checking. Retry verification.');
      }
      setEvents(events => recordCompletion(events, habit.id, finished, provider, { ...result, checkedAt: finished.toISOString() }));
      setVerificationStatus(`${habit.name}: verified ${result.count} ${result.unit}.`);
    } catch (error) {
      setVerificationStatus(error instanceof Error ? error.message : 'Verification failed.');
    } finally { setVerifying(false); }
  };
  const deleteHabit = (id: string) => {
    if (!window.confirm('Delete this habit? Completion history will be retained.')) return;
    setHabits(current => current.filter(habit => habit.id !== id));
    if (editingHabit?.id === id) setEditingHabit(null);
  };
  const togglePause = (id: string) => {
    setHabits(current => current.map(habit => habit.id === id
      ? { ...habit, paused: !habit.paused, updatedAt: new Date().toISOString() }
      : habit));
  };

  return <main>
    <h1>Habit Forge</h1>
    <p className="sub">Local-first consistency dashboard</p>
    <p className="muted" role="status">{bridgeStatus}</p>
    {error && <p role="alert">{error}</p>}
    {verificationStatus && <p role="status">{verificationStatus}</p>}
    <HabitForm habits={habits} onAdd={addHabit} editingHabit={editingHabit}
      onUpdate={updateHabit} onCancelEdit={() => setEditingHabit(null)} />
    <HabitList habits={habits} events={events} onToggle={toggleComplete}
      onDelete={deleteHabit} onPause={togglePause} onEdit={setEditingHabit}
      graceDays={settings.graceDays} onGrace={toggleGrace} now={now} onVerify={verifyHabit} verifying={verifying} />
    {!desktop && <SettingsPanel settings={settings} onChange={setSettings} />}
    <Analytics habits={habits} events={events} settings={settings} now={now} />
  </main>;
}

