import { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserRole = 'admin' | 'senior_carer' | 'carer';

type UserData = {
  role: UserRole;
  careRecipientId: string;
  careRecipientName: string | null;
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

async function loadUserData(userId: string): Promise<UserData | null> {
  const { data: roleData, error } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id')
    .eq('user_id', userId)
    .single();
  if (error || !roleData) return null;

  const { data: recipientData } = await supabase
    .from('care_recipients')
    .select('name')
    .eq('id', roleData.care_recipient_id)
    .single();

  return {
    role: roleData.role as UserRole,
    careRecipientId: roleData.care_recipient_id,
    careRecipientName: recipientData?.name ?? null,
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
      if (session) applyUserData(await loadUserData(session.user.id));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        applyUserData(await loadUserData(session.user.id));
      } else {
        applyUserData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) applyUserData(await loadUserData(session.user.id));
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
