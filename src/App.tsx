
import { useEffect, useState } from 'react';
import type { Habit } from '../shared/types';
import HabitForm from './components/HabitForm';
import HabitList from './components/HabitList';
import { loadHabits, saveHabits } from './lib/storage';

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);

  const [editingHabit, setEditingHabit] =
    useState<Habit | null>(null);

  useEffect(() => {
    saveHabits(habits);
  }, [habits]);

  const addHabit = (habit: Habit) => {
    setHabits((current) => [...current, habit]);
  };

  const updateHabit = (updatedHabit: Habit) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === updatedHabit.id
          ? updatedHabit
          : habit,
      ),
    );

    setEditingHabit(null);
  };

  const toggleComplete = (id: string) => {
    // Completion state will be moved into a dedicated
    // activity model in the next stage.
    console.log('Complete habit:', id);
  };

  const deleteHabit = (id: string) => {
    setHabits((current) =>
      current.filter((habit) => habit.id !== id),
    );

    // If the habit being edited is deleted, close the editor.
    if (editingHabit?.id === id) {
      setEditingHabit(null);
    }
  };

  const togglePause = (id: string) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === id
          ? {
              ...habit,
              paused: !habit.paused,
              updatedAt: new Date().toISOString(),
            }
          : habit,
      ),
    );
  };

  const repeatRoutine = () => {
    setHabits((current) =>
      current.map((habit) => ({
        ...habit,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        updatedAt: new Date().toISOString(),
      })),
    );
  };

  return (
    <main>
      <h1>Habit Forge</h1>

      <p className="sub">
        Local-first consistency dashboard
      </p>

      <HabitForm
        onAdd={addHabit}
        editingHabit={editingHabit}
        onUpdate={updateHabit}
        onCancelEdit={() => setEditingHabit(null)}
      />

      <HabitList
        habits={habits}
        onToggle={toggleComplete}
        onDelete={deleteHabit}
        onPause={togglePause}
        onEdit={setEditingHabit}
      />

      <section className="card">
        <div className="row">
          <h2>Routine</h2>

          <button onClick={repeatRoutine}>
            ↻ Repeat routine
          </button>
        </div>

        <p className="muted">
          Repeat routine currently applies all seven days to every
          habit. More flexible day-by-day routines will be added in
          Phase 3.
        </p>
      </section>

      <section className="card">
        <h2>7-day completion snapshot</h2>

        <div className="bars">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(
            (day, index) => (
              <div key={index}>
                <i style={{ height: '45px' }} />
                <small>{day}</small>
              </div>
            ),
          )}
        </div>

        <p className="muted">
          Analytics will be connected to real completion events in
          the streak/analytics phases.
        </p>
      </section>
    </main>
  );
}

