import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PRNMedication } from './usePRNMedications';

type UpdatePRNMedicationVars = {
  careRecipientId: string;
  medicationId: string;
  name: string;
  notes: string | null;
};

export function useUpdatePRNMedication() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: UpdatePRNMedicationVars) => {
      const { data, error } = await supabase
        .from('as_needed_medications')
        .update({ name: vars.name, notes: vars.notes })
        .eq('id', vars.medicationId)
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
