import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'senior_carer' | 'carer';

type PatientAssignment = {
  careRecipientId: string;
  careRecipientName: string | null;
  role: UserRole;
};

const ACTIVE_PATIENT_STORAGE_KEY = 'active-care-recipient-id';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  allPatients: PatientAssignment[];
  activePatient: PatientAssignment | null;
  setActivePatient: (careRecipientId: string) => Promise<void>;
  role: UserRole | null;
  careRecipientId: string | null;
  careRecipientName: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAllPatients(userId: string): Promise<PatientAssignment[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, care_recipient_id, care_recipients(name)')
    .eq('user_id', userId);
  if (error || !data) return [];

  return data.map((row) => {
    const careRecipient = Array.isArray(row.care_recipients)
      ? row.care_recipients[0]
      : row.care_recipients;

    return {
      careRecipientId: row.care_recipient_id,
      careRecipientName: careRecipient?.name ?? null,
      role: row.role as UserRole,
    };
  });
}

async function resolveActivePatient(
  patients: PatientAssignment[],
): Promise<PatientAssignment | null> {
  const storedId = await AsyncStorage.getItem(ACTIVE_PATIENT_STORAGE_KEY);
  const stored = storedId ? patients.find((p) => p.careRecipientId === storedId) : undefined;
  if (stored) return stored;

  if (storedId) await AsyncStorage.removeItem(ACTIVE_PATIENT_STORAGE_KEY);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPatients, setAllPatients] = useState<PatientAssignment[]>([]);
  const [activePatient, setActivePatientState] = useState<PatientAssignment | null>(null);

  async function applyUserData(userId: string | null) {
    if (!userId) {
      setAllPatients([]);
      setActivePatientState(null);
      return;
    }

    const patients = await loadAllPatients(userId);
    setAllPatients(patients);
    setActivePatientState(await resolveActivePatient(patients));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await applyUserData(session?.user.id ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await applyUserData(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await applyUserData(session?.user.id ?? null);
  }, []);

  const setActivePatient = useCallback(
    async (careRecipientId: string) => {
      const match = allPatients.find((p) => p.careRecipientId === careRecipientId);
      if (!match) return;
      await AsyncStorage.setItem(ACTIVE_PATIENT_STORAGE_KEY, careRecipientId);
      setActivePatientState(match);
    },
    [allPatients],
  );

  const signOut = async () => {
    await AsyncStorage.removeItem(ACTIVE_PATIENT_STORAGE_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        allPatients,
        activePatient,
        setActivePatient,
        role: activePatient?.role ?? null,
        careRecipientId: activePatient?.careRecipientId ?? null,
        careRecipientName: activePatient?.careRecipientName ?? null,
        isAdmin: activePatient?.role === 'admin',
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
