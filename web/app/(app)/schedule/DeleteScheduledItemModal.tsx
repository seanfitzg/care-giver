'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '../components/Modal';
import { primaryBtnStyle, secondaryBtnStyle } from '../components/modalStyles';
import type { ScheduledItemFull } from './types';

interface Props {
  item: ScheduledItemFull;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export default function DeleteScheduledItemModal({ item, onClose, onDeleted }: Props) {
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('scheduled_items')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      setSubmitting(false);
      setError('Could not delete this item — please try again.');
      return;
    }
    onDeleted(item.id);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={400}>
      <h2 id={titleId} style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
        Delete &ldquo;{item.name}&rdquo;?
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>
        This can&rsquo;t be undone. Historical log entries that reference this item will be kept.
      </p>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
          style={{ ...primaryBtnStyle('#dc2626'), opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
