import { useEffect, useState } from 'react';
import type {
  Habit,
  HabitCategory,
  VerificationMethod,
} from '../../shared/types';

interface HabitFormProps {
  habits: Habit[];
  onAdd: (habit: Habit) => void;
  editingHabit?: Habit | null;
  onUpdate?: (habit: Habit) => void;
  onCancelEdit?: () => void;
}

const categories: HabitCategory[] = [
  'coding',
  'learning',
  'fitness',
  'personal',
  'other',
];

const verificationMethods: VerificationMethod[] = [
  'manual',
  'github',
  'leetcode',
  'kaggle',
];

export default function HabitForm({
  habits,
  onAdd,
  editingHabit,
  onUpdate,
  onCancelEdit,
}: HabitFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] =
    useState<HabitCategory>('coding');
  const [minimumRequirement, setMinimumRequirement] = useState(1);
  const [website, setWebsite] = useState('');
  const [scheduledTime, setScheduledTime] = useState('21:00');
  const [mandatory, setMandatory] = useState(true);
  const [verificationUsername, setVerificationUsername] = useState('');
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [verificationMethod, setVerificationMethod] =
    useState<VerificationMethod>('manual');

  useEffect(() => {
    if (!editingHabit) {
      resetForm();
      return;
    }

    setName(editingHabit.name);
    setDescription(editingHabit.description);
    setCategory(editingHabit.category);
    setMinimumRequirement(editingHabit.minimumRequirement);
    setWebsite(editingHabit.website);
    setScheduledTime(editingHabit.scheduledTime);
    setMandatory(editingHabit.mandatory);
    setVerificationUsername(editingHabit.verificationUsername || '');
    setActiveDays(editingHabit.activeDays);
    setVerificationMethod(editingHabit.verificationMethod);
  }, [editingHabit]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('coding');
    setMinimumRequirement(1);
    setWebsite('');
    setScheduledTime('21:00');
    setMandatory(true);
    setVerificationUsername('');
    setActiveDays([0, 1, 2, 3, 4, 5, 6]);
    setVerificationMethod('manual');
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();

    if (!trimmedName || !activeDays.length || !Number.isInteger(minimumRequirement) || minimumRequirement < 1 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime)) {
      alert('Provide a name, a valid time, a positive requirement, and at least one active day.');
      return;
    }

    const duplicate = habits.some(
      (habit) =>
        habit.name.toLowerCase() ===
        trimmedName.toLowerCase() &&
        habit.id !== editingHabit?.id,
    );

    if (duplicate) {
      alert('A habit with this name already exists.');
      return;
    }

    const now = new Date().toISOString();
    let normalizedWebsite = '';
    if (website.trim()) {
      try {
        const url = new URL(website.includes('://') ? website.trim() : `https://${website.trim()}`);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe URL');
        normalizedWebsite = url.href;
      } catch {
        alert('Enter an HTTP(S) website URL without embedded credentials.');
        return;
      }
    }

    if (editingHabit && onUpdate) {
      onUpdate({
        ...editingHabit,
        name: trimmedName,
        description: description.trim(),
        category,
        minimumRequirement: Math.max(
          1,
          minimumRequirement,
        ),
        website: normalizedWebsite,
        scheduledTime,
        activeDays,
        mandatory,
        verificationMethod,
        verificationUsername: verificationUsername.trim(),
        updatedAt: now,
      });

      return;
    }

    const habit: Habit = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description.trim(),
      category,
      minimumRequirement: Math.max(
        1,
        minimumRequirement,
      ),
      website: normalizedWebsite,
      scheduledTime,
      activeDays,
      mandatory,
      verificationMethod,
      verificationUsername: verificationUsername.trim(),
      paused: false,
      createdAt: now,
      updatedAt: now,
    };

    onAdd(habit);
    resetForm();
  };

  return (
    <section className="card">
      <h2>{editingHabit ? 'Edit habit' : 'Add habit'}</h2>

      <div className="form">
        {verificationMethod !== 'manual' && <input aria-label={`${verificationMethod} username`} placeholder={`${verificationMethod} username`} value={verificationUsername}
          onChange={e => setVerificationUsername(e.target.value)} />}
        {verificationMethod !== 'manual' && <p className="muted">{verificationMethod === 'github'
          ? 'Verification counts public pushes, opened pull requests, and opened issues. Private activity is not checked.'
          : verificationMethod === 'leetcode'
            ? 'Experimental verification: distinct problems accepted today from public recent activity.'
            : 'Verification counts owned notebooks with a latest run today. Configure Kaggle credentials in the local verification service.'}</p>}
        <fieldset className="weekdays"><legend>Active days</legend>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => <label key={day}>
            <input type="checkbox" checked={activeDays.includes(day)} onChange={e => setActiveDays(current =>
              e.target.checked ? [...current, day].sort() : current.filter(item => item !== day))} />{label}
          </label>)}
        </fieldset>
        <input
          placeholder="Habit name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />

        <input
          placeholder="Description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
        />

        <select
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value as HabitCategory,
            )
          }
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          value={minimumRequirement}
          onChange={(event) =>
            setMinimumRequirement(
              Number(event.target.value),
            )
          }
        />

        <input
          placeholder="Website"
          value={website}
          onChange={(event) =>
            setWebsite(event.target.value)
          }
        />

        <input
          type="time"
          value={scheduledTime}
          onChange={(event) =>
            setScheduledTime(event.target.value)
          }
        />

        <select
          value={verificationMethod}
          onChange={(event) =>
            setVerificationMethod(
              event.target.value as VerificationMethod,
            )
          }
        >
          {verificationMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(event) =>
              setMandatory(event.target.checked)
            }
          />
          Mandatory
        </label>

        <button onClick={handleSubmit}>
          {editingHabit ? 'Save changes' : 'Add habit'}
        </button>

        {editingHabit && (
          <button
            type="button"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

