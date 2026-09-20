'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { switchActivePatient } from '@/app/actions/patients';
import type { PatientAssignment } from '@/lib/patients';
import { roleLabel } from '@/lib/roleLabel';
import Icon from './Icon';

interface PatientSwitcherProps {
  patients: PatientAssignment[];
  activePatientId: string;
  activePatientName: string;
  activePatientAge: number | null;
  onNavigate?: () => void;
}

export default function PatientSwitcher({
  patients,
  activePatientId,
  activePatientName,
  activePatientAge,
  onNavigate,
}: PatientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSelect(careRecipientId: string) {
    setOpen(false);
    if (isPending || careRecipientId === activePatientId) return;
    startTransition(() => {
      switchActivePatient(careRecipientId);
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginTop: 14 }}>
      <button
        type="button"
        onClick={() => !isPending && setOpen((isOpen) => !isOpen)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={isPending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: isPending ? 'default' : 'pointer',
          textAlign: 'left',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          🧒
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {activePatientName}
          </div>
          {activePatientAge !== null && (
            <div style={{ fontSize: 11, color: '#6b7280' }}>Age {activePatientAge}</div>
          )}
        </div>
        <Icon name="chevron-down" size={14} color="#9ca3af" />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          {patients.map((patient) => {
            const active = patient.careRecipientId === activePatientId;
            return (
              <button
                key={patient.careRecipientId}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(patient.careRecipientId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  background: active ? '#eff6ff' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {patient.careRecipientName ?? 'Unnamed patient'}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{roleLabel(patient.role)}</div>
              </button>
            );
          })}

          <Link
            href="/picker"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '9px 12px',
              borderTop: '1px solid #e5e7eb',
              textDecoration: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#2563eb',
            }}
          >
            Manage teams
          </Link>
        </div>
      )}
    </div>
  );
}
