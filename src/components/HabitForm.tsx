import { useEffect, useState } from 'react';
import type {
  Habit,
  HabitCategory,
  VerificationMethod,
} from '../../shared/types';

interface HabitFormProps {
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
    setVerificationMethod('manual');
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    const now = new Date().toISOString();

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
        website: website.trim(),
        scheduledTime,
        mandatory,
        verificationMethod,
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
      website: website.trim(),
      scheduledTime,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      mandatory,
      verificationMethod,
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