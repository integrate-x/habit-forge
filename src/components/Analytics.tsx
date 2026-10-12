import type { Habit, CompletionEvent } from '../../shared/types';
import type { Settings } from '../lib/settings';
import { getAnalytics } from '../lib/analytics';
import { getHabitStreak } from '../lib/completions';

export default function Analytics({ habits, events, settings, now }: {
  habits: Habit[]; events: CompletionEvent[]; settings: Settings; now: Date;
}) {
  const rows = getAnalytics(habits, events, settings, now);
  const scheduled = rows.reduce((sum, row) => sum + row.scheduled, 0);
  const completed = rows.reduce((sum, row) => sum + row.completed, 0);
  return <section className="card">
    <h2>Last 30 days</h2>
    <p>{completed} / {scheduled} scheduled completions · {scheduled ? Math.round(completed / scheduled * 100) + '%' : 'No scheduled habits'}</p>
    <div className="analytics-grid">{rows.map(row => <div key={row.date} title={`${row.date}: ${row.completed}/${row.scheduled}`}
      aria-label={`${row.date}: ${row.completed} of ${row.scheduled} complete`}
      style={{ background: row.rate === null ? '#303641' : row.rate === 100 ? '#18764a' : row.rate > 0 ? '#536f53' : '#623840' }}>
      {Number(row.date.slice(-2))}
    </div>)}</div>
    <div className="table-scroll"><table><thead><tr><th>Habit</th><th>Current streak</th><th>Best streak</th><th>Recorded completions</th></tr></thead>
      <tbody>{habits.map(habit => {
        const streak = getHabitStreak(habit, events, now, settings.graceDays.filter(day => day.habitId === habit.id).map(day => day.localDate));
        return <tr key={habit.id}><th>{habit.name}</th><td>{streak.current}</td><td>{streak.longest}</td>
          <td>{new Set(events.filter(event => event.habitId === habit.id && event.localDate <= rows[rows.length - 1].date).map(event => event.localDate)).size}</td></tr>;
      })}</tbody></table></div>
    <p className="muted">Rates use current schedules and exclude paused habits and Grace Days. Schedule history is not reconstructed.</p>
  </section>;
}
