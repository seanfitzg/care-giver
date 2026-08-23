import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PRNMedication } from './usePRNMedications';

type AddPRNMedicationVars = {
  careRecipientId: string;
  createdBy: string;
  name: string;
  notes: string | null;
};

export function useAddPRNMedication() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: AddPRNMedicationVars) => {
      const { data, error } = await supabase
        .from('as_needed_medications')
        .insert({
          care_recipient_id: vars.careRecipientId,
          name: vars.name,
          notes: vars.notes,
          created_by: vars.createdBy,
        })
        .select('id, name, notes')
        .single();
      if (error) throw error;
      return data as PRNMedication;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['prn-medications', vars.careRecipientId] });
    },
  });
}
