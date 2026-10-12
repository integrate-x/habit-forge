import { useEffect, useState } from 'react';
import type { Habit, CompletionEvent } from '../shared/types';
import HabitForm from './components/HabitForm';
import HabitList from './components/HabitList';
import { loadHabits, saveHabits } from './lib/storage';
import { loadCompletionEvents, saveCompletionEvents } from './lib/completionStorage';
import { recordCompletion } from './lib/completions';
import { publishExtensionSnapshot } from './lib/extensionBridge';

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [events, setEvents] = useState<CompletionEvent[]>(loadCompletionEvents);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  useEffect(() => saveHabits(habits), [habits]);
  useEffect(() => saveCompletionEvents(events), [events]);
  useEffect(() => publishExtensionSnapshot(habits, events), [habits, events]);

  const addHabit = (habit: Habit) => setHabits((current) => [...current, habit]);

  const updateHabit = (updatedHabit: Habit) => {
    setHabits((current) => current.map((habit) => habit.id === updatedHabit.id ? updatedHabit : habit));
    setEditingHabit(null);
  };

  const toggleComplete = (id: string) => {
    setEvents((current) => recordCompletion(current, id));
  };

  const deleteHabit = (id: string) => {
    setHabits((current) => current.filter((habit) => habit.id !== id));
    if (editingHabit?.id === id) setEditingHabit(null);
  };

  const togglePause = (id: string) => {
    setHabits((current) => current.map((habit) => habit.id === id
      ? { ...habit, paused: !habit.paused, updatedAt: new Date().toISOString() }
      : habit));
  };

  const repeatRoutine = () => {
    setHabits((current) => current.map((habit) => ({
      ...habit,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      updatedAt: new Date().toISOString(),
    })));
  };

  return (
    <main>
      <h1>Habit Forge</h1>
      <p className="sub">Local-first consistency dashboard</p>
      <HabitForm habits={habits} onAdd={addHabit} editingHabit={editingHabit}
        onUpdate={updateHabit} onCancelEdit={() => setEditingHabit(null)} />
      <HabitList habits={habits} events={events} onToggle={toggleComplete}
        onDelete={deleteHabit} onPause={togglePause} onEdit={setEditingHabit} />
      <section className="card">
        <div className="row"><h2>Routine</h2><button onClick={repeatRoutine}>↻ Repeat routine</button></div>
        <p className="muted">Repeat routine currently applies all seven days to every habit. More flexible day-by-day routines will be added in Phase 3.</p>
      </section>
      <section className="card">
        <h2>7-day completion snapshot</h2>
        <div className="bars">
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const count = events.filter((event) => event.localDate === dateKey).length;
            return <div key={dateKey}><i style={{ height: `${Math.max(4, Math.min(100, count * 18))}px` }} /><small>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</small></div>;
          })}
        </div>
        <p className="muted">Bars show recorded completion events per day.</p>
      </section>
    </main>
  );
}
