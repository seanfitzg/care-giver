import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserRole = 'admin' | 'senior_carer' | 'carer';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  careRecipientId: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserRole(userId: string): Promise<{ role: UserRole; careRecipientId: string } | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return { role: data.role as UserRole, careRecipientId: data.care_recipient_id };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [careRecipientId, setCareRecipientId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const roleData = await fetchUserRole(session.user.id);
        setRole(roleData?.role ?? null);
        setCareRecipientId(roleData?.careRecipientId ?? null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const roleData = await fetchUserRole(session.user.id);
        setRole(roleData?.role ?? null);
        setCareRecipientId(roleData?.careRecipientId ?? null);
      } else {
        setRole(null);
        setCareRecipientId(null);
      }
    });

    return () => subscription.unsubscribe();
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
      isAdmin: role === 'admin',
      signOut,
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
