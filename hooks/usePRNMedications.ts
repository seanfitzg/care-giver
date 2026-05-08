import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PRNMedication = {
  id: string;
  name: string;
  notes: string | null;
};

export function usePRNMedications(careRecipientId: string | null) {
  return useQuery({
    queryKey: ['prn-medications', careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('as_needed_medications')
        .select('id, name, notes')
        .eq('care_recipient_id', careRecipientId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as PRNMedication[];
    },
    enabled: !!careRecipientId,
  });
}
