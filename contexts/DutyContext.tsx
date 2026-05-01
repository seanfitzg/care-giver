import { createContext, useContext, useState } from 'react';

type DutyContextValue = {
  isOnDuty: boolean;
  checkIn: () => void;
  checkOut: () => void;
};

const DutyContext = createContext<DutyContextValue | null>(null);

export function DutyProvider({ children }: { children: React.ReactNode }) {
  const [isOnDuty, setIsOnDuty] = useState(false);

  const checkIn = () => setIsOnDuty(true);
  const checkOut = () => setIsOnDuty(false);

  return (
    <DutyContext.Provider value={{ isOnDuty, checkIn, checkOut }}>
      {children}
    </DutyContext.Provider>
  );
}

export function useDuty() {
  const ctx = useContext(DutyContext);
  if (!ctx) throw new Error('useDuty must be used within DutyProvider');
  return ctx;
}
