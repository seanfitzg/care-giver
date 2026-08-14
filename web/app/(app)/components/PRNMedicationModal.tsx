'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from './Modal';
import { primaryBtnStyle, secondaryBtnStyle, textareaStyle } from './modalStyles';
import type { EventEntry, PRNMedication } from './types';

const PRN_COLOR = '#7c3aed';
const PRN_BG = '#f5f3ff';

interface Props {
  medications: PRNMedication[];
  careRecipientId: string;
  carerId: string;
  onClose: () => void;
  onRecorded: (event: EventEntry) => void;
}

export default function PRNMedicationModal({
  medications,
  careRecipientId,
  carerId,
  onClose,
  onRecorded,
}: Props) {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('event_log')
      .insert({
        care_recipient_id: careRecipientId,
        event_type: 'as_needed_medication',
        scheduled_item_id: null,
        prn_medication_id: selectedId,
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
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        As-needed medication
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 }}>
        Logged at the current time.
      </p>

      {medications.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          No as-needed medications are set up yet. Ask an admin to add one.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Select medication"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}
        >
          {medications.map((med) => {
            const selected = med.id === selectedId;
            return (
              <button
                key={med.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedId(med.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: 12,
                  borderRadius: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: `1px solid ${selected ? PRN_COLOR : '#e5e7eb'}`,
                  background: selected ? PRN_BG : '#fff',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{med.name}</span>
                {med.notes && <span style={{ fontSize: 12, color: '#6b7280' }}>{med.notes}</span>}
              </button>
            );
          })}
        </div>
      )}

      {medications.length > 0 && (
        <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={textareaStyle}
            placeholder="e.g. dose, reason…"
          />
        </label>
      )}

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        {medications.length > 0 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
            style={{
              ...primaryBtnStyle(PRN_COLOR),
              opacity: selectedId && !submitting ? 1 : 0.5,
            }}
          >
            {submitting ? 'Recording…' : 'Record medication'}
          </button>
        )}
      </div>
    </Modal>
  );
}
