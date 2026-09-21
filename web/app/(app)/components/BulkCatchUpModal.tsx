'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from './Modal';
import { primaryBtnStyle, secondaryBtnStyle, textareaStyle } from './modalStyles';
import { formatTimeOfDay, typeLabel, type EventEntry, type ScheduledItem } from './types';

interface Props {
  items: ScheduledItem[];
  careRecipientId: string;
  carerId: string;
  onClose: () => void;
  onRecorded: (events: EventEntry[]) => void;
}

export default function BulkCatchUpModal({
  items,
  careRecipientId,
  carerId,
  onClose,
  onRecorded,
}: Props) {
  const titleId = useId();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const occurredAt = new Date().toISOString();
    const trimmedNotes = notes.trim() || null;

    const nutritionItems = items.filter((item) => item.type === 'nutrition');

    if (nutritionItems.length > 0) {
      const { error: sessionError } = await supabase.from('nutrition_sessions').insert(
        nutritionItems.map((item) => ({
          care_recipient_id: careRecipientId,
          scheduled_item_id: item.id,
          carer_id: carerId,
          started_at: occurredAt,
          completed_at: occurredAt,
          all_consumed: null,
          bulk_confirmed: true,
          notes: trimmedNotes,
        })),
      );
      if (sessionError) {
        setSubmitting(false);
        setError('Could not record these — please try again.');
        return;
      }
    }

    const { data, error: insertError } = await supabase
      .from('event_log')
      .insert(
        items.map((item) => ({
          care_recipient_id: careRecipientId,
          event_type: item.type,
          scheduled_item_id: item.id,
          carer_id: carerId,
          occurred_at: occurredAt,
          status: 'completed',
          bulk_confirmed: true,
          notes: trimmedNotes,
        })),
      )
      .select('id, scheduled_item_id, carer_id, occurred_at, status, event_type');

    if (insertError || !data) {
      setSubmitting(false);
      setError('Could not record these — please try again.');
      return;
    }
    onRecorded(data as EventEntry[]);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={480}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4338ca', marginBottom: 4 }}>
        Mark all as done
      </div>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        Mark {items.length} {items.length === 1 ? 'item' : 'items'} as done
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 14 }}>
        One note applies to all selected items.
      </p>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          marginBottom: 16,
          padding: 0,
          maxHeight: 160,
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: 13.5,
            }}
          >
            <span style={{ color: '#111827', fontWeight: 500 }}>{item.name}</span>
            <span style={{ color: '#9ca3af', fontSize: 12, flexShrink: 0 }}>
              {typeLabel(item.type)} · {formatTimeOfDay(item.time_of_day)}
            </span>
          </li>
        ))}
      </ul>

      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={textareaStyle}
          placeholder="e.g. caught up after handover…"
        />
      </label>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ ...primaryBtnStyle('#4338ca'), opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Recording…' : 'Mark as done'}
        </button>
      </div>
    </Modal>
  );
}
