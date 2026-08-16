'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '../components/Modal';
import {
  fieldLabelStyle,
  inputStyle,
  primaryBtnStyle,
  secondaryBtnStyle,
  selectStyle,
  textareaStyle,
} from '../components/modalStyles';
import type { NutritionType } from '../components/types';
import {
  DAY_LABELS,
  SCHEDULED_ITEM_COLUMNS,
  type ScheduledItemFull,
  type ScheduledItemFullType,
} from './types';

const ACCENT = '#2563eb';

interface Props {
  careRecipientId: string;
  userId: string;
  item: ScheduledItemFull | null;
  onClose: () => void;
  onSaved: (item: ScheduledItemFull) => void;
}

export default function ScheduledItemModal({
  careRecipientId,
  userId,
  item,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId();
  const isEdit = item !== null;

  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<ScheduledItemFullType>(item?.type ?? 'medication_scheduled');
  const [timeOfDay, setTimeOfDay] = useState(item?.time_of_day?.slice(0, 5) ?? '');
  const [overdueWindowMinutes, setOverdueWindowMinutes] = useState(
    String(item?.overdue_window_minutes ?? 15),
  );
  const [isCompulsory, setIsCompulsory] = useState(item?.is_compulsory ?? true);
  const [recurrence, setRecurrence] = useState<'every_day' | 'specific'>(
    item?.days_of_week ? 'specific' : 'every_day',
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(item?.days_of_week ?? []);
  const [description, setDescription] = useState(item?.description ?? '');
  const [nutritionType, setNutritionType] = useState<NutritionType>(
    item?.nutrition_type ?? 'bolus',
  );
  const [bolusRestMinutes, setBolusRestMinutes] = useState(
    item?.bolus_rest_minutes != null ? String(item.bolus_rest_minutes) : '',
  );
  const [durationMinutes, setDurationMinutes] = useState(
    item?.duration_minutes != null ? String(item.duration_minutes) : '',
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  function validate(): string | null {
    if (!name.trim()) return 'Name is required.';
    if (!timeOfDay) return 'Time of day is required.';
    const overdue = Number(overdueWindowMinutes);
    if (!Number.isFinite(overdue) || overdue < 0) {
      return 'Overdue window must be a non-negative number of minutes.';
    }
    if (recurrence === 'specific' && daysOfWeek.length === 0) {
      return 'Select at least one day, or choose Every day.';
    }
    if (type === 'activity') {
      const duration = Number(durationMinutes);
      if (!durationMinutes || !Number.isFinite(duration) || duration <= 0) {
        return 'Duration is required for activities.';
      }
    }
    if (type === 'nutrition' && nutritionType === 'bolus') {
      const rest = Number(bolusRestMinutes);
      if (!bolusRestMinutes || !Number.isFinite(rest) || rest <= 0) {
        return 'Bolus rest duration is required for bolus nutrition schedules.';
      }
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      care_recipient_id: careRecipientId,
      type,
      name: name.trim(),
      time_of_day: timeOfDay,
      overdue_window_minutes: Number(overdueWindowMinutes),
      is_compulsory: isCompulsory,
      days_of_week: recurrence === 'every_day' ? null : daysOfWeek,
      description: description.trim() || null,
      nutrition_type: type === 'nutrition' ? nutritionType : null,
      bolus_rest_minutes:
        type === 'nutrition' && nutritionType === 'bolus' ? Number(bolusRestMinutes) : null,
      duration_minutes: type === 'activity' ? Number(durationMinutes) : null,
    };

    const supabase = createClient();
    const query = isEdit
      ? supabase.from('scheduled_items').update(payload).eq('id', item!.id)
      : supabase.from('scheduled_items').insert({ ...payload, created_by: userId });

    const { data, error: saveError } = await query.select(SCHEDULED_ITEM_COLUMNS).single();

    if (saveError || !data) {
      setSubmitting(false);
      setError('Could not save this item — please try again.');
      return;
    }
    onSaved(data as unknown as ScheduledItemFull);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={520}>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        {isEdit ? 'Edit scheduled item' : 'New scheduled item'}
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 18 }}>
        {isEdit ? 'Update the details below.' : 'Fill in the details for the new item.'}
      </p>

      <label style={fieldLabelStyle}>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="e.g. Morning medication"
        />
      </label>

      <label style={fieldLabelStyle}>
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ScheduledItemFullType)}
          style={selectStyle}
        >
          <option value="medication_scheduled">Medication</option>
          <option value="nutrition">Nutrition</option>
          <option value="activity">Activity</option>
        </select>
      </label>

      <div style={{ display: 'flex', gap: 12 }}>
        <label style={{ ...fieldLabelStyle, flex: 1 }}>
          Time of day
          <input
            type="time"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ ...fieldLabelStyle, flex: 1 }}>
          Overdue window (min)
          <input
            type="number"
            min={0}
            value={overdueWindowMinutes}
            onChange={(e) => setOverdueWindowMinutes(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {type === 'nutrition' && (
        <label style={fieldLabelStyle}>
          Nutrition type
          <select
            value={nutritionType}
            onChange={(e) => setNutritionType(e.target.value as NutritionType)}
            style={selectStyle}
          >
            <option value="bolus">Bolus</option>
            <option value="oral_self">Oral (self-fed)</option>
            <option value="oral_carer">Oral (carer-fed)</option>
          </select>
        </label>
      )}

      {type === 'nutrition' && nutritionType === 'bolus' && (
        <label style={fieldLabelStyle}>
          Bolus rest duration (min)
          <input
            type="number"
            min={1}
            value={bolusRestMinutes}
            onChange={(e) => setBolusRestMinutes(e.target.value)}
            style={inputStyle}
            placeholder="e.g. 20"
          />
        </label>
      )}

      {type === 'activity' && (
        <label style={fieldLabelStyle}>
          Duration (min)
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            style={inputStyle}
            placeholder="e.g. 30"
          />
        </label>
      )}

      <label style={fieldLabelStyle}>
        Recurrence
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as 'every_day' | 'specific')}
          style={selectStyle}
        >
          <option value="every_day">Every day</option>
          <option value="specific">Specific days</option>
        </select>
      </label>

      {recurrence === 'specific' && (
        <div
          role="group"
          aria-label="Days of week"
          style={{ display: 'flex', gap: 6, marginBottom: 14, marginTop: -6 }}
        >
          {DAY_LABELS.map((label, day) => {
            const selected = daysOfWeek.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleDay(day)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: `1px solid ${selected ? ACCENT : '#d1d5db'}`,
                  background: selected ? '#eff6ff' : '#fff',
                  color: selected ? ACCENT : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
          color: '#374151',
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={isCompulsory}
          onChange={(e) => setIsCompulsory(e.target.checked)}
        />
        Compulsory (missing this is treated as critical)
      </label>

      <label style={fieldLabelStyle}>
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={textareaStyle}
          placeholder="Any extra instructions for carers…"
        />
      </label>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ ...primaryBtnStyle(ACCENT), opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create item'}
        </button>
      </div>
    </Modal>
  );
}
