import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type StartSessionVars = {
  careRecipientId: string;
  scheduledItemId: string;
  carerId: string;
  startedAt: string;
  bolusRestMinutes?: number;
};

type EndSessionVars = {
  sessionId: string;
  careRecipientId: string;
  scheduledItemId: string;
  carerId: string;
  allConsumed: boolean;
  notes?: string;
  completedAt: string;
};

type AbandonSessionVars = {
  sessionId: string;
  careRecipientId: string;
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
          bolus_rest_minutes: vars.bolusRestMinutes ?? null,
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
            all_consumed: vars.allConsumed,
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
        .update({ notes: vars.notes || null })
        .eq('id', vars.sessionId);
      if (error) throw error;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['timeline', vars.careRecipientId] });
    },
  });
}
