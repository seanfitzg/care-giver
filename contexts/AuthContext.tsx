import { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserRole = 'admin' | 'senior_carer' | 'carer';

type UserData = {
  role: UserRole;
  careRecipientId: string;
  careRecipientName: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  careRecipientId: string | null;
  careRecipientName: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserData(userId: string): Promise<UserData | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id, care_recipients(name)')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  const recipient = data.care_recipients as unknown as { name: string } | null;
  return {
    role: data.role as UserRole,
    careRecipientId: data.care_recipient_id,
    careRecipientName: recipient?.name ?? '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [careRecipientId, setCareRecipientId] = useState<string | null>(null);
  const [careRecipientName, setCareRecipientName] = useState<string | null>(null);

  function applyUserData(data: UserData | null) {
    setRole(data?.role ?? null);
    setCareRecipientId(data?.careRecipientId ?? null);
    setCareRecipientName(data?.careRecipientName ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) applyUserData(await fetchUserData(session.user.id));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        applyUserData(await fetchUserData(session.user.id));
      } else {
        applyUserData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession) applyUserData(await fetchUserData(currentSession.user.id));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      role,
      careRecipientId,
      careRecipientName,
      isAdmin: role === 'admin',
      signOut,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
