'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { selectActivePatient } from '@/app/actions/patients';
import { roleLabel } from '@/lib/roleLabel';
import type { PatientAssignment } from '@/lib/patients';
import LeaveTeamModal from './LeaveTeamModal';

interface Props {
  initialPatients: PatientAssignment[];
  activePatientId: string | null;
}

export default function PickerList({ initialPatients, activePatientId }: Props) {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientAssignment[]>(initialPatients);
  const [leavingPatient, setLeavingPatient] = useState<PatientAssignment | null>(null);

  function handleLeft(careRecipientId: string) {
    const remaining = patients.filter((patient) => patient.careRecipientId !== careRecipientId);
    setPatients(remaining);
    if (remaining.length === 0) router.push('/pending');
  }

  return (
    <>
      <div className="space-y-2">
        {patients.map((patient) => {
          const active = patient.careRecipientId === activePatientId;
          const canLeave = patient.role !== 'admin';
          const patientName = patient.careRecipientName ?? 'Unnamed patient';
          return (
            <div
              key={patient.careRecipientId}
              className={`overflow-hidden rounded-md border ${
                active ? 'border-blue-500 bg-blue-50' : 'border-neutral-300'
              }`}
            >
              <form action={selectActivePatient}>
                <input type="hidden" name="careRecipientId" value={patient.careRecipientId} />
                <button
                  type="submit"
                  className="w-full cursor-pointer px-4 py-3 text-left text-sm hover:bg-neutral-50"
                >
                  <div className="font-medium text-neutral-900">{patientName}</div>
                  <div className="text-xs text-neutral-500">{roleLabel(patient.role)}</div>
                </button>
              </form>

              {canLeave && (
                <button
                  type="button"
                  onClick={() => setLeavingPatient(patient)}
                  aria-label={`Leave ${patientName}'s team`}
                  className="w-full cursor-pointer border-t border-neutral-100 px-4 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Leave
                </button>
              )}
            </div>
          );
        })}
      </div>

      {leavingPatient && (
        <LeaveTeamModal
          patient={leavingPatient}
          onClose={() => setLeavingPatient(null)}
          onLeft={handleLeft}
        />
      )}
    </>
  );
}
