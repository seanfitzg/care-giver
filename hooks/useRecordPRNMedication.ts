import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type RecordPRNVars = {
  careRecipientId: string;
  prnMedicationId: string;
  carerId: string;
  notes?: string;
};

export function useRecordPRNMedication() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: RecordPRNVars) => {
      const { error } = await supabase.from('event_log').insert({
        care_recipient_id: vars.careRecipientId,
        event_type: 'as_needed_medication',
        scheduled_item_id: null,
        prn_medication_id: vars.prnMedicationId,
        carer_id: vars.carerId,
        occurred_at: new Date().toISOString(),
        status: 'completed',
        notes: vars.notes || null,
      });
      if (error) throw error;
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['care-log', vars.careRecipientId] });
    },
  });
}
