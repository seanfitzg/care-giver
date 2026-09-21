'use client';

import { useId } from 'react';
import Modal from './Modal';
import { formatTimeOfDay, typeLabel, type ScheduledItem } from './types';

const ACCENT: Record<ScheduledItem['type'], { color: string; bg: string }> = {
  medication_scheduled: { color: '#2563eb', bg: '#eff6ff' },
  nutrition: { color: '#d97706', bg: '#fffbeb' },
  activity: { color: '#16a34a', bg: '#f0fdf4' },
};

interface Props {
  item: ScheduledItem;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  onClose: () => void;
}

export default function ScheduledItemDetailModal({
  item,
  statusLabel,
  statusColor,
  statusBg,
  onClose,
}: Props) {
  const titleId = useId();
  const accent = ACCENT[item.type];

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div style={{ fontSize: 12, fontWeight: 600, color: accent.color, marginBottom: 4 }}>
        {typeLabel(item.type)}
      </div>
      <h2 id={titleId} style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: 0 }}>
        {item.name}
      </h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 10 }}>
        Scheduled for {formatTimeOfDay(item.time_of_day)}
      </p>

      <span
        style={{
          display: 'inline-block',
          fontSize: 11.5,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 20,
          background: statusBg,
          color: statusColor,
          marginBottom: 16,
        }}
      >
        {statusLabel}
      </span>

      {item.description ? (
        <div
          style={{
            background: accent.bg,
            borderRadius: 8,
            padding: 10,
          }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.5, color: accent.color, margin: 0 }}>
            {item.description}
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
          No description
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#fff',
            color: '#374151',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
