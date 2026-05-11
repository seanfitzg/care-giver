import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FetchedTimeline } from './useTimeline';

type SkipActivityVars = {
  careRecipientId: string;
  scheduledItemId: string;
  carerId: string;
};

export function useSkipActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: SkipActivityVars) => {
      const { error } = await supabase.from('event_log').insert({
        care_recipient_id: vars.careRecipientId,
        event_type: 'activity',
        scheduled_item_id: vars.scheduledItemId,
        carer_id: vars.carerId,
        occurred_at: new Date().toISOString(),
        status: 'skipped',
      });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['timeline', vars.careRecipientId] });
      const previous = qc.getQueryData<FetchedTimeline>(['timeline', vars.careRecipientId]);
      qc.setQueryData<FetchedTimeline>(['timeline', vars.careRecipientId], (old) => {
        if (!old) return old;
        return {
          ...old,
          todayEvents: [
            ...old.todayEvents,
            {
              id: `optimistic-${Date.now()}`,
              scheduled_item_id: vars.scheduledItemId,
              occurred_at: new Date().toISOString(),
              status: 'skipped' as const,
              carer_id: vars.carerId,
            },
          ],
        };
      });
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      const { previous } = (ctx ?? {}) as { previous?: FetchedTimeline };
      if (previous !== undefined) {
        qc.setQueryData(['timeline', vars.careRecipientId], previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['timeline', vars.careRecipientId] });
    },
  });
}
