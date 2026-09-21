'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import InviteCarerModal from './InviteCarerModal';
import RevokeCarerModal from './RevokeCarerModal';
import { formatLastSignIn, roleLabel, type CarerRow } from './types';

interface Props {
  careRecipientId: string;
  currentUserId: string;
  currentUserRole: 'admin' | 'senior_carer';
  initialCarers: CarerRow[];
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13.5,
  color: '#111827',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

const roleSelectStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#111827',
  background: '#fff',
};

export default function CarerTable({
  careRecipientId,
  currentUserId,
  currentUserRole,
  initialCarers,
}: Props) {
  const isAdminViewer = currentUserRole === 'admin';
  const [carers, setCarers] = useState<CarerRow[]>(initialCarers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeCandidate, setRevokeCandidate] = useState<CarerRow | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ userId: string; message: string } | null>(null);

  async function handleRoleChange(carer: CarerRow, newRole: 'carer' | 'senior_carer') {
    setSavingUserId(carer.user_id);
    setRowError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', carer.user_id)
      .eq('care_recipient_id', careRecipientId);

    setSavingUserId(null);
    if (error) {
      setRowError({ userId: carer.user_id, message: 'Could not update role — please try again.' });
      return;
    }
    setCarers((prev) =>
      prev.map((c) => (c.user_id === carer.user_id ? { ...c, role: newRole } : c)),
    );
  }

  function handleInvited(carer: CarerRow) {
    setCarers((prev) => [...prev, carer]);
  }

  function handleRevoked(userId: string) {
    setCarers((prev) => prev.filter((c) => c.user_id !== userId));
  }

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Care team</h1>
        {isAdminViewer && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            style={{
              background: '#2563eb',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Invite carer
          </button>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Last sign-in</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {carers.map((carer) => {
              const isSelf = carer.user_id === currentUserId;
              const canManage = isAdminViewer && !isSelf && carer.role !== 'admin';
              const saving = savingUserId === carer.user_id;
              return (
                <tr key={carer.user_id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {carer.name ?? carer.email ?? carer.user_id}
                    {carer.email && (
                      <div
                        style={{ fontSize: 11.5, fontWeight: 400, color: '#6b7280', marginTop: 2 }}
                      >
                        {carer.email}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {canManage ? (
                      <select
                        value={carer.role}
                        disabled={saving}
                        onChange={(e) =>
                          handleRoleChange(carer, e.target.value as 'carer' | 'senior_carer')
                        }
                        style={{ ...roleSelectStyle, opacity: saving ? 0.6 : 1 }}
                      >
                        <option value="carer">Carer</option>
                        <option value="senior_carer">Senior Carer</option>
                      </select>
                    ) : (
                      roleLabel(carer.role)
                    )}
                    {rowError?.userId === carer.user_id && (
                      <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4 }}>
                        {rowError.message}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{formatLastSignIn(carer.last_sign_in_at)}</td>
                  <td style={tdStyle}>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setRevokeCandidate(carer)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <InviteCarerModal
          careRecipientId={careRecipientId}
          onClose={() => setInviteOpen(false)}
          onInvited={handleInvited}
        />
      )}

      {revokeCandidate && (
        <RevokeCarerModal
          carer={revokeCandidate}
          careRecipientId={careRecipientId}
          onClose={() => setRevokeCandidate(null)}
          onRevoked={handleRevoked}
        />
      )}
    </div>
  );
}
