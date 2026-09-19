'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import type { PatientAssignment } from '@/lib/patients';
import { roleLabel } from '@/lib/roleLabel';
import Icon from './Icon';
import PatientSwitcher from './PatientSwitcher';

const NAV = [
  { href: '/', label: 'Today', icon: 'today' },
  { href: '/schedule', label: 'Schedule', icon: 'calendar' },
  { href: '/log', label: 'Care log', icon: 'list' },
];

interface SidebarProps {
  isAdmin: boolean;
  isSeniorCarer: boolean;
  email: string;
  role: string;
  patients: PatientAssignment[];
  activePatientId: string;
  careRecipientName: string;
  careRecipientAge: number | null;
  onClose: () => void;
}

function initials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  isAdmin,
  isSeniorCarer,
  email,
  role,
  patients,
  activePatientId,
  careRecipientName,
  careRecipientAge,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const canManageTeam = isAdmin || isSeniorCarer;

  return (
    <aside
      style={{
        width: 230,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
        borderRight: '1px solid #e5e7eb',
      }}
      className="flex h-full flex-col bg-white"
    >
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 14,
            fontWeight: 700,
            color: '#111827',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="pulse" size={14} color="#fff" />
          </div>
          care-giver
        </div>
        {careRecipientName && (
          <PatientSwitcher
            patients={patients}
            activePatientId={activePatientId}
            activePatientName={careRecipientName}
            activePatientAge={careRecipientAge}
          />
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 10 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                background: active ? '#eff6ff' : 'transparent',
                color: active ? '#2563eb' : '#374151',
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon name={icon} size={18} color={active ? '#2563eb' : '#6b7280'} />
              {label}
            </Link>
          );
        })}

        {canManageTeam &&
          (() => {
            const active = isActive('/admin');
            return (
              <Link
                href="/admin"
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  textDecoration: 'none',
                  background: active ? '#eff6ff' : 'transparent',
                  color: active ? '#2563eb' : '#374151',
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon name="people" size={18} color={active ? '#2563eb' : '#6b7280'} />
                Care team
              </Link>
            );
          })()}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: 14,
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        {/* Initials avatar */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#2563eb',
            flexShrink: 0,
          }}
        >
          {initials(email)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {email}
          </div>
          <div style={{ fontSize: 10.5, color: '#6b7280' }}>{roleLabel(role)}</div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: '#9ca3af',
            }}
          >
            <Icon name="log-out" size={16} color="#9ca3af" />
          </button>
        </form>
      </div>
    </aside>
  );
}
