import type { NutritionType } from '../components/types';

export type ScheduledItemFullType = 'medication_scheduled' | 'nutrition' | 'activity';

export interface ScheduledItemFull {
  id: string;
  care_recipient_id: string;
  type: ScheduledItemFullType;
  name: string;
  time_of_day: string | null;
  overdue_window_minutes: number;
  is_compulsory: boolean;
  days_of_week: number[] | null;
  description: string | null;
  nutrition_type: NutritionType | null;
  bolus_rest_minutes: number | null;
  duration_minutes: number | null;
}

export const SCHEDULED_ITEM_COLUMNS =
  'id, care_recipient_id, type, name, time_of_day, overdue_window_minutes, is_compulsory, days_of_week, description, nutrition_type, bolus_rest_minutes, duration_minutes';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function daysOfWeekLabel(days: number[] | null): string {
  if (days === null || days.length === 0) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}
