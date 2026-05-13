import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type CareLogEntry = {
  id: string;
  event_type: 'medication_scheduled' | 'as_needed_medication' | 'nutrition' | 'activity' | 'missed';
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  notes: string | null;
  carer_id: string | null;
  bulk_confirmed: boolean;
  scheduled_item: { name: string; description: string | null } | null;
  prn_medication: { name: string; notes: string | null } | null;
};

export function useCareLogs(careRecipientId: string | null, date: Date) {
  return useQuery({
    queryKey: ['care-log', careRecipientId, date.toDateString()],
    queryFn: async () => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const [{ data: entries, error: entriesErr }, { data: names, error: namesErr }] =
        await Promise.all([
          supabase
            .from('event_log')
            .select(
              'id, event_type, occurred_at, status, notes, carer_id, bulk_confirmed, scheduled_item:scheduled_items(name, description), prn_medication:as_needed_medications(name, notes)',
            )
            .eq('care_recipient_id', careRecipientId!)
            .gte('occurred_at', start.toISOString())
            .lte('occurred_at', end.toISOString())
            .order('occurred_at', { ascending: false })
            .limit(200),
          supabase.rpc('get_carer_names', { p_care_recipient_id: careRecipientId }),
        ]);

      if (entriesErr) throw entriesErr;
      if (namesErr) throw namesErr;

      const carerNames: Record<string, string> = {};
      for (const row of names ?? []) {
        carerNames[row.user_id] = row.display_name;
      }

      return { entries: (entries ?? []) as unknown as CareLogEntry[], carerNames };
    },
    enabled: !!careRecipientId,
  });
}
