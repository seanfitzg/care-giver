export interface ScheduledItem {
  id: string;
  type: 'medication_scheduled' | 'nutrition' | 'activity';
  name: string;
  time_of_day: string;
  overdue_window_minutes: number;
  days_of_week: number[] | null;
}

export interface EventEntry {
  id: string;
  scheduled_item_id: string | null;
  carer_id: string | null;
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  event_type: 'medication_scheduled' | 'as_needed_medication' | 'nutrition' | 'activity';
}

export interface CarerName {
  user_id: string;
  display_name: string;
}

export interface PRNMedication {
  id: string;
  name: string;
  notes: string | null;
}

export type ItemStatus = 'pending' | 'overdue' | 'completed' | 'missed' | 'skipped';

export function formatTimeOfDay(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
}

export function typeLabel(type: string): string {
  if (type === 'medication_scheduled') return 'Medication';
  if (type === 'nutrition') return 'Nutrition';
  return 'Activity';
}
