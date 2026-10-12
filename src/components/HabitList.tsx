import type { CompletionEvent, Habit } from '../../shared/types';
import { getHabitStreak, isCompletedOn, localDateKey } from '../lib/completions';

interface HabitListProps {
  habits: Habit[];
  events: CompletionEvent[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onEdit: (habit: Habit) => void;
  graceDays: { habitId: string; localDate: string }[];
  onGrace: (id: string) => void;
  now: Date;
  onVerify: (habit: Habit) => void;
  verifying: boolean;
}

export default function HabitList({ habits, events, onToggle, onDelete, onPause, onEdit, graceDays, onGrace, now, onVerify, verifying }: HabitListProps) {
  const today = localDateKey(now);
  return (
    <section className="card">
      <div className="row"><h2>Today's routine</h2></div>
      {habits.length === 0 && <p className="muted">No habits yet. Add your first habit above.</p>}
      {habits.map((habit) => {
        const doneToday = isCompletedOn(events, habit.id, today);
        const grace = graceDays.some(day => day.habitId === habit.id && day.localDate === today);
        const scheduled = habit.activeDays.includes(now.getDay());
        const streak = getHabitStreak(habit, events, now, graceDays.filter(day => day.habitId === habit.id).map(day => day.localDate));
        return (
          <div className="habit" key={habit.id}>
            <div>
              <strong>{habit.name}</strong>
              <span>{habit.scheduledTime} · {habit.website || 'No website'}</span>
              <span>{habit.minimumRequirement} required · {habit.category} · {habit.mandatory ? 'Mandatory' : 'Optional'}</span>
              {habit.description && <span>{habit.description}</span>}
              <span>Verification: {habit.verificationMethod}</span>
              <span>Streak: {streak.current} current · {streak.longest} best</span>
              {habit.paused && <span>Paused</span>}
              {!scheduled && <span>Not scheduled today</span>}
              {grace && <span>Grace Day</span>}
            </div>
            <button onClick={() => onToggle(habit.id)} className={doneToday ? 'done' : ''}
              disabled={habit.paused || doneToday || !scheduled} aria-pressed={doneToday}>
              {doneToday ? 'Completed today' : habit.verificationMethod === 'manual' ? 'Complete' : 'Complete manually'}
            </button>
            {habit.verificationMethod === 'github' && <button disabled={verifying || habit.paused || doneToday || !scheduled}
              onClick={() => onVerify(habit)}>{verifying ? 'Checking...' : 'Verify GitHub'}</button>}
            <button disabled={habit.paused || doneToday || !scheduled} onClick={() => onGrace(habit.id)}>{grace ? 'Remove Grace Day' : 'Use Grace Day'}</button>
            <button onClick={() => onEdit(habit)}>Edit</button>
            <button onClick={() => onPause(habit.id)}>{habit.paused ? 'Resume' : 'Pause'}</button>
            <button className="delete" onClick={() => onDelete(habit.id)}>Delete</button>
          </div>
        );
      })}
    </section>
  );
}

