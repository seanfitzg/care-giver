import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FetchedTimeline } from './useTimeline';

type StartSessionVars = {
  careRecipientId: string;
  scheduledItemId: string;
  carerId: string;
  startedAt: string;
};

type EndSessionVars = {
  sessionId: string;
  careRecipientId: string;
  scheduledItemId: string;
  carerId: string;
  bolusRoundsCompleted: number;
  notes?: string;
  completedAt: string;
};

type AbandonSessionVars = {
  sessionId: string;
  careRecipientId: string;
  bolusRoundsCompleted: number;
  notes?: string;
};

export function useStartNutritionSession() {
  return useMutation({
    mutationFn: async (vars: StartSessionVars) => {
      const { data, error } = await supabase
        .from('nutrition_sessions')
        .insert({
          care_recipient_id: vars.careRecipientId,
          scheduled_item_id: vars.scheduledItemId,
          carer_id: vars.carerId,
          started_at: vars.startedAt,
          bulk_confirmed: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
  });
}

export function useEndNutritionSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: EndSessionVars) => {
      const [sessionResult, logResult] = await Promise.all([
        supabase
          .from('nutrition_sessions')
          .update({
            completed_at: vars.completedAt,
            bolus_rounds_completed: vars.bolusRoundsCompleted,
            notes: vars.notes || null,
          })
          .eq('id', vars.sessionId),
        supabase.from('event_log').insert({
          care_recipient_id: vars.careRecipientId,
          event_type: 'nutrition',
          scheduled_item_id: vars.scheduledItemId,
          carer_id: vars.carerId,
          occurred_at: vars.completedAt,
          status: 'completed',
        }),
      ]);
      if (sessionResult.error) throw sessionResult.error;
      if (logResult.error) throw logResult.error;
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
              occurred_at: vars.completedAt,
              status: 'completed' as const,
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

export function useAbandonNutritionSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: AbandonSessionVars) => {
      const { error } = await supabase
        .from('nutrition_sessions')
        .update({
          bolus_rounds_completed: vars.bolusRoundsCompleted,
          notes: vars.notes || null,
        })
        .eq('id', vars.sessionId);
      if (error) throw error;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['timeline', vars.careRecipientId] });
    },
  });
}
