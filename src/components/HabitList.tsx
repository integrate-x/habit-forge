import type { Habit } from '../../shared/types';

interface HabitListProps {
  habits: Habit[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
}

export default function HabitList({
  habits,
  onToggle,
  onDelete,
  onPause,
}: HabitListProps) {
  return (
    <section className="card">
      <div className="row">
        <h2>Today's routine</h2>
      </div>

      {habits.length === 0 && (
        <p className="muted">No habits yet. Add your first habit above.</p>
      )}

      {habits.map((habit) => (
        <div className="habit" key={habit.id}>
          <div>
            <strong>{habit.name}</strong>

            <span>
              {habit.scheduledTime} · {habit.website || 'No website'}
            </span>

            <span>
              {habit.minimumRequirement} required · {habit.category} ·{' '}
              {habit.mandatory ? 'Mandatory' : 'Optional'}
            </span>

            {habit.description && (
              <span>{habit.description}</span>
            )}

            {habit.paused && (
              <span>Paused</span>
            )}
          </div>

          <button
            onClick={() => onToggle(habit.id)}
            className={habit.paused ? '' : 'done'}
          >
            {habit.paused ? 'Paused' : 'Complete'}
          </button>

          <button onClick={() => onPause(habit.id)}>
            {habit.paused ? 'Resume' : 'Pause'}
          </button>

          <button
            className="delete"
            onClick={() => onDelete(habit.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}