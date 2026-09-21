'use client';

import { useId, useState, useTransition } from 'react';
import Modal from '@/app/(app)/components/Modal';
import { primaryBtnStyle, secondaryBtnStyle } from '@/app/(app)/components/modalStyles';
import { leaveCareRecipient } from '@/app/actions/patients';
import type { PatientAssignment } from '@/lib/patients';

interface Props {
  patient: PatientAssignment;
  onClose: () => void;
  onLeft: (careRecipientId: string) => void;
}

export default function LeaveTeamModal({ patient, onClose, onLeft }: Props) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const patientName = patient.careRecipientName ?? 'this patient';

  function handleDismiss() {
    if (isPending) return;
    onClose();
  }

  function handleLeave() {
    setError(null);
    startTransition(async () => {
      const result = await leaveCareRecipient(patient.careRecipientId);
      if (result.error) {
        setError(result.error);
        return;
      }
      onLeft(patient.careRecipientId);
      onClose();
    });
  }

  return (
    <Modal onClose={handleDismiss} labelledBy={titleId} maxWidth={400}>
      <h2 id={titleId} style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
        Leave this team?
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, marginBottom: 4 }}>
        You&apos;ll lose access to {patientName}&apos;s schedule and care log unless you&apos;re
        invited back.
      </p>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          style={secondaryBtnStyle}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleLeave}
          disabled={isPending}
          style={{ ...primaryBtnStyle('#dc2626'), opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? 'Leaving…' : 'Leave'}
        </button>
      </div>
    </Modal>
  );
}
