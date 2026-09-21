'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from './Modal';
import { primaryBtnStyle, secondaryBtnStyle, textareaStyle } from './modalStyles';
import { formatTimeOfDay, typeLabel, type EventEntry, type ScheduledItem } from './types';

const ACCENT: Record<ScheduledItem['type'], string> = {
  medication_scheduled: '#2563eb',
  nutrition: '#d97706',
  activity: '#16a34a',
};

interface Props {
  item: ScheduledItem;
  careRecipientId: string;
  carerId: string;
  onClose: () => void;
  onRecorded: (event: EventEntry) => void;
}

export default function RecordItemModal({
  item,
  careRecipientId,
  carerId,
  onClose,
  onRecorded,
}: Props) {
  const titleId = useId();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = ACCENT[item.type];

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('event_log')
      .insert({
        care_recipient_id: careRecipientId,
        event_type: item.type,
        scheduled_item_id: item.id,
        carer_id: carerId,
        occurred_at: new Date().toISOString(),
        status: 'completed',
        notes: notes.trim() || null,
      })
      .select('id, scheduled_item_id, carer_id, occurred_at, status, event_type')
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError('Could not record this — please try again.');
      return;
    }
    onRecorded(data as EventEntry);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div style={{ fontSize: 12, fontWeight: 600, color: accent, marginBottom: 4 }}>
        {typeLabel(item.type)}
      </div>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        {item.name}
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 }}>
        Scheduled for {formatTimeOfDay(item.time_of_day)}
      </p>

      {item.description && (
        <div
          style={{
            background: '#f9fafb',
            borderRadius: 8,
            padding: 10,
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#374151', margin: 0 }}>
            {item.description}
          </p>
        </div>
      )}

      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={textareaStyle}
          placeholder="e.g. refused, partial dose…"
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
          style={{ ...primaryBtnStyle(accent), opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Recording…' : 'Record as done'}
        </button>
      </div>
    </Modal>
  );
}
