export type NutritionType = 'bolus' | 'oral_self' | 'oral_carer';

export interface ScheduledItem {
  id: string;
  type: 'medication_scheduled' | 'nutrition' | 'activity';
  name: string;
  time_of_day: string;
  overdue_window_minutes: number;
  is_compulsory: boolean;
  days_of_week: number[] | null;
  description: string | null;
  nutrition_type: NutritionType | null;
  bolus_rest_minutes: number | null;
}

export interface NutritionSession {
  id: string;
  care_recipient_id: string;
  scheduled_item_id: string | null;
  carer_id: string;
  started_at: string;
  completed_at: string | null;
  all_consumed: boolean | null;
  notes: string | null;
  bolus_rest_minutes: number | null;
  bolus_rounds_completed: number | null;
  rest_started_at: string | null;
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
