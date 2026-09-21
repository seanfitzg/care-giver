import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FetchedTimeline, TimelineItem } from './useTimeline';

type BulkCatchUpVars = {
  careRecipientId: string;
  carerId: string;
  items: TimelineItem[];
  notes?: string;
};

export function useBulkCatchUp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: BulkCatchUpVars) => {
      const { careRecipientId, carerId, items, notes } = vars;
      const occurredAt = new Date().toISOString();

      const nutritionItems = items.filter((i) => i.type === 'nutrition');
      const nonNutritionItems = items.filter((i) => i.type !== 'nutrition');

      const eventLogRows = nonNutritionItems.map((item) => ({
        care_recipient_id: careRecipientId,
        event_type: item.type,
        scheduled_item_id: item.scheduledItemId,
        carer_id: carerId,
        occurred_at: occurredAt,
        status: 'completed' as const,
        bulk_confirmed: true,
        notes: notes || null,
      }));

      for (const item of nutritionItems) {
        const sessionResult = await supabase.from('nutrition_sessions').insert({
          care_recipient_id: careRecipientId,
          scheduled_item_id: item.scheduledItemId,
          carer_id: carerId,
          started_at: occurredAt,
          completed_at: occurredAt,
          all_consumed: null,
          bulk_confirmed: true,
          notes: notes || null,
        });
        if (sessionResult.error) throw sessionResult.error;

        eventLogRows.push({
          care_recipient_id: careRecipientId,
          event_type: item.type,
          scheduled_item_id: item.scheduledItemId,
          carer_id: carerId,
          occurred_at: occurredAt,
          status: 'completed' as const,
          bulk_confirmed: true,
          notes: notes || null,
        });
      }

      if (eventLogRows.length > 0) {
        const { error } = await supabase.from('event_log').insert(eventLogRows);
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['timeline', vars.careRecipientId] });
      const previous = qc.getQueryData<FetchedTimeline>(['timeline', vars.careRecipientId]);
      qc.setQueryData<FetchedTimeline>(['timeline', vars.careRecipientId], (old) => {
        if (!old) return old;
        const occurredAt = new Date().toISOString();
        const optimisticEvents = vars.items.map((item, i) => ({
          id: `optimistic-bulk-${Date.now()}-${i}`,
          scheduled_item_id: item.scheduledItemId,
          occurred_at: occurredAt,
          status: 'completed' as const,
          carer_id: vars.carerId,
        }));
        return { ...old, todayEvents: [...old.todayEvents, ...optimisticEvents] };
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
      qc.invalidateQueries({ queryKey: ['care-log', vars.careRecipientId] });
    },
  });
}
