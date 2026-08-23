'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '../components/Modal';
import {
  fieldLabelStyle,
  inputStyle,
  primaryBtnStyle,
  secondaryBtnStyle,
  textareaStyle,
} from '../components/modalStyles';
import type { PRNMedication } from '../components/types';

const ACCENT = '#2563eb';

interface Props {
  careRecipientId: string;
  currentUserId: string;
  medication?: PRNMedication;
  onClose: () => void;
  onSaved: (medication: PRNMedication) => void;
}

export default function MedicationFormModal({
  careRecipientId,
  currentUserId,
  medication,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId();
  const isEdit = medication !== undefined;
  const [name, setName] = useState(medication?.name ?? '');
  const [notes, setNotes] = useState(medication?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a medication name.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const trimmedNotes = notes.trim() || null;

    const { data, error: saveError } = isEdit
      ? await supabase
          .from('as_needed_medications')
          .update({ name: trimmedName, notes: trimmedNotes })
          .eq('id', medication.id)
          .select('id, name, notes')
          .single()
      : await supabase
          .from('as_needed_medications')
          .insert({
            care_recipient_id: careRecipientId,
            name: trimmedName,
            notes: trimmedNotes,
            created_by: currentUserId,
          })
          .select('id, name, notes')
          .single();

    if (saveError || !data) {
      setSubmitting(false);
      setError('Could not save this medication — please try again.');
      return;
    }
    onSaved(data as PRNMedication);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={420}>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        {isEdit ? 'Edit medication' : 'Add as-needed medication'}
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 18 }}>
        Carers will be able to record doses of this medication at any time.
      </p>

      <label style={fieldLabelStyle}>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="e.g. Paracetamol"
        />
      </label>

      <label style={fieldLabelStyle}>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={textareaStyle}
          placeholder="e.g. dose, max frequency…"
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
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add medication'}
        </button>
      </div>
    </Modal>
  );
}
