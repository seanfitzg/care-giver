'use client';

import { useState } from 'react';
import MedicationFormModal from './MedicationFormModal';
import type { PRNMedication } from '../components/types';

interface Props {
  careRecipientId: string;
  currentUserId: string;
  initialMedications: PRNMedication[];
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

export default function AsNeededMedicationsTable({
  careRecipientId,
  currentUserId,
  initialMedications,
}: Props) {
  const [medications, setMedications] = useState<PRNMedication[]>(initialMedications);
  const [addOpen, setAddOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<PRNMedication | null>(null);

  function handleAdded(medication: PRNMedication) {
    setMedications((prev) => [...prev, medication].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleEdited(medication: PRNMedication) {
    setMedications((prev) =>
      prev
        .map((m) => (m.id === medication.id ? medication : m))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
          As-needed medications
        </h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
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
          + Add medication
        </button>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          overflowX: 'auto',
        }}
      >
        {medications.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6b7280', padding: 14 }}>
            No as-needed medications yet. Add one so carers can record ad-hoc doses.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Notes</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((medication) => (
                <tr key={medication.id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{medication.name}</td>
                  <td style={tdStyle}>{medication.notes ?? '—'}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => setEditCandidate(medication)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <MedicationFormModal
          careRecipientId={careRecipientId}
          currentUserId={currentUserId}
          onClose={() => setAddOpen(false)}
          onSaved={handleAdded}
        />
      )}

      {editCandidate && (
        <MedicationFormModal
          careRecipientId={careRecipientId}
          currentUserId={currentUserId}
          medication={editCandidate}
          onClose={() => setEditCandidate(null)}
          onSaved={handleEdited}
        />
      )}
    </div>
  );
}
