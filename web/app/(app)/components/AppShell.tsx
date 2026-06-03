'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  email: string;
  role: string;
  careRecipientName: string;
  careRecipientAge: number | null;
  children: React.ReactNode;
}

export default function AppShell({
  email,
  role,
  careRecipientName,
  careRecipientAge,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = role === 'admin';
  const isSeniorCarer = role === 'senior_carer';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f9fafb' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          isAdmin={isAdmin}
          isSeniorCarer={isSeniorCarer}
          email={email}
          role={role}
          careRecipientName={careRecipientName}
          careRecipientAge={careRecipientAge}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Right-hand column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={email} onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
