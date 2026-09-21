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
} from '../components/modalStyles';
import type { CarerRow } from './types';

const ACCENT = '#2563eb';

interface Props {
  careRecipientId: string;
  onClose: () => void;
  onInvited: (carer: CarerRow) => void;
}

export default function InviteCarerModal({ careRecipientId, onClose, onInvited }: Props) {
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'carer' | 'senior_carer'>('carer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter an email address.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSubmitting(false);
      setError('Your session could not be found — try refreshing the page and signing in again.');
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke('invite-carer', {
      body: {
        email: trimmed,
        role,
        care_recipient_id: careRecipientId,
        redirect_to: `${window.location.origin}/setup`,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    const body = data as { success?: boolean; user_id?: string; error?: string } | null;

    if (invokeError || !body?.success || !body.user_id) {
      setSubmitting(false);
      setError(body?.error ?? 'Could not send the invite — please try again.');
      return;
    }

    onInvited({
      id: body.user_id,
      user_id: body.user_id,
      role,
      email: trimmed,
      name: trimmed,
      last_sign_in_at: null,
    });
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={420}>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        Invite a carer
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 18 }}>
        If they don&rsquo;t already have an account, they&rsquo;ll receive an email with a secure
        setup link. If they do, they&rsquo;re added to this care team right away.
      </p>

      <label style={fieldLabelStyle}>
        Email address
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          placeholder="name@example.com"
          autoComplete="email"
        />
      </label>

      <label style={fieldLabelStyle}>
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'carer' | 'senior_carer')}
          style={selectStyle}
        >
          <option value="carer">Carer</option>
          <option value="senior_carer">Senior Carer</option>
        </select>
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
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </Modal>
  );
}
