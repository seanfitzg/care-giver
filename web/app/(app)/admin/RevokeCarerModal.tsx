'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '../components/Modal';
import { primaryBtnStyle, secondaryBtnStyle } from '../components/modalStyles';
import type { CarerRow } from './types';

interface Props {
  carer: CarerRow;
  careRecipientId: string;
  onClose: () => void;
  onRevoked: (userId: string) => void;
}

export default function RevokeCarerModal({ carer, careRecipientId, onClose, onRevoked }: Props) {
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', carer.user_id)
      .eq('care_recipient_id', careRecipientId);

    if (deleteError) {
      setSubmitting(false);
      setError('Could not revoke access — please try again.');
      return;
    }
    onRevoked(carer.user_id);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={400}>
      <h2 id={titleId} style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
        Revoke access?
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>
        Remove {carer.email ?? carer.user_id} from this care team? They will no longer be able to
        view or record care events.
      </p>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={submitting}
          style={{ ...primaryBtnStyle('#dc2626'), opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Revoking…' : 'Revoke access'}
        </button>
      </div>
    </Modal>
  );
}
