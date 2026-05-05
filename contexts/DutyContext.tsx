import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type DutyContextValue = {
  isOnDuty: boolean;
  loading: boolean;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
};

const DutyContext = createContext<DutyContextValue | null>(null);

export function DutyProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, careRecipientId } = useAuth();
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOnDuty = isAdmin || hasOpenSession;

  const fetchOpenSession = useCallback(async () => {
    if (!user || !careRecipientId || isAdmin) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('duty_sessions')
      .select('id')
      .eq('carer_id', user.id)
      .eq('care_recipient_id', careRecipientId)
      .is('checked_out_at', null)
      .limit(1)
      .maybeSingle();
    setHasOpenSession(!!data);
    setLoading(false);
  }, [user, isAdmin, careRecipientId]);

  useEffect(() => {
    setLoading(true);
    fetchOpenSession();
  }, [fetchOpenSession]);

  useEffect(() => {
    if (!user || !careRecipientId || isAdmin) return;
    const channel = supabase
      .channel(`duty_self:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'duty_sessions',
          filter: `carer_id=eq.${user.id}`,
        },
        () => fetchOpenSession(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, careRecipientId, fetchOpenSession]);

  const checkIn = useCallback(async () => {
    if (!user || !careRecipientId) return;
    const { error } = await supabase.from('duty_sessions').insert({
      carer_id: user.id,
      care_recipient_id: careRecipientId,
    });
    if (!error) setHasOpenSession(true);
  }, [user, careRecipientId]);

  const checkOut = useCallback(async () => {
    if (!user || !careRecipientId) return;
    const { error } = await supabase
      .from('duty_sessions')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('carer_id', user.id)
      .eq('care_recipient_id', careRecipientId)
      .is('checked_out_at', null);
    if (!error) setHasOpenSession(false);
  }, [user, careRecipientId]);

  return (
    <DutyContext.Provider value={{ isOnDuty, loading, checkIn, checkOut }}>
      {children}
    </DutyContext.Provider>
  );
}

export function useDuty() {
  const ctx = useContext(DutyContext);
  if (!ctx) throw new Error('useDuty must be used within DutyProvider');
  return ctx;
}
