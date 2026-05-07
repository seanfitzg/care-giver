import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type CareLogEntry = {
  id: string;
  event_type: 'medication_scheduled' | 'as_needed_medication' | 'nutrition' | 'activity' | 'missed';
  occurred_at: string;
  status: 'completed' | 'missed' | 'skipped';
  notes: string | null;
  carer_id: string | null;
  scheduled_item: { name: string } | null;
  prn_medication: { name: string } | null;
};

export function useCareLogs(careRecipientId: string | null) {
  return useQuery({
    queryKey: ['care-log', careRecipientId],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

      const [{ data: entries, error: entriesErr }, { data: names, error: namesErr }] =
        await Promise.all([
          supabase
            .from('event_log')
            .select(
              'id, event_type, occurred_at, status, notes, carer_id, scheduled_item:scheduled_items(name), prn_medication:as_needed_medications(name)',
            )
            .eq('care_recipient_id', careRecipientId!)
            .gte('occurred_at', sevenDaysAgo)
            .order('occurred_at', { ascending: false })
            .limit(100),
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
