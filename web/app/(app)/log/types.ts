export type LogEventType =
  'medication_scheduled' | 'as_needed_medication' | 'nutrition' | 'activity';
export type LogStatus = 'completed' | 'missed' | 'skipped';

// The "missed" filter option maps to status = 'missed' rather than event_type,
// since mark_missed_events() writes the scheduled item's real type + status='missed'.
export type LogTypeFilter = LogEventType | 'missed';

export interface LogEntry {
  id: string;
  care_recipient_id: string;
  event_type: LogEventType;
  scheduled_item_id: string | null;
  carer_id: string | null;
  occurred_at: string;
  status: LogStatus;
  notes: string | null;
  bulk_confirmed: boolean;
}

export const LOG_ENTRY_COLUMNS =
  'id, care_recipient_id, event_type, scheduled_item_id, carer_id, occurred_at, status, notes, bulk_confirmed';

export const PAGE_SIZE = 50;

export const TYPE_FILTER_OPTIONS: { value: LogTypeFilter | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'medication_scheduled', label: 'Medication' },
  { value: 'as_needed_medication', label: 'As-needed medication' },
  { value: 'nutrition', label: 'Feeding' },
  { value: 'activity', label: 'Activity' },
  { value: 'missed', label: 'Missed' },
];

export function eventTypeLabel(type: LogEventType): string {
  switch (type) {
    case 'medication_scheduled':
      return 'Medication';
    case 'as_needed_medication':
      return 'As-needed medication';
    case 'nutrition':
      return 'Feeding';
    case 'activity':
      return 'Activity';
  }
}

export function statusLabel(status: LogStatus): string {
  if (status === 'completed') return 'Completed';
  if (status === 'missed') return 'Missed';
  return 'Skipped';
}

export function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
