'use client';

import { useMemo, useState } from 'react';
import { formatTimeOfDay, typeLabel } from '../components/types';
import DeleteScheduledItemModal from './DeleteScheduledItemModal';
import ScheduledItemModal from './ScheduledItemModal';
import { daysOfWeekLabel, type ScheduledItemFull } from './types';

interface Props {
  careRecipientId: string;
  userId: string;
  initialItems: ScheduledItemFull[];
  canManage: boolean;
}

type SortKey = 'name' | 'type' | 'time_of_day' | 'overdue_window_minutes' | 'is_compulsory';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'time_of_day', label: 'Time / days' },
  { key: 'overdue_window_minutes', label: 'Overdue window' },
  { key: 'is_compulsory', label: 'Compulsory' },
];

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
  verticalAlign: 'top',
};

export default function ScheduleTable({ careRecipientId, userId, initialItems, canManage }: Props) {
  const [items, setItems] = useState<ScheduledItemFull[]>(initialItems);
  const [sortKey, setSortKey] = useState<SortKey>('time_of_day');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [formItem, setFormItem] = useState<ScheduledItemFull | null | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<ScheduledItemFull | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'time_of_day') {
        cmp = (a.time_of_day ?? '').localeCompare(b.time_of_day ?? '');
      } else if (sortKey === 'is_compulsory') {
        cmp = Number(a.is_compulsory) - Number(b.is_compulsory);
      } else if (sortKey === 'overdue_window_minutes') {
        cmp = a.overdue_window_minutes - b.overdue_window_minutes;
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortKey, sortDir]);

  function handleSaved(saved: ScheduledItemFull) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Schedule</h1>
        {canManage && (
          <button
            type="button"
            onClick={() => setFormItem(null)}
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
            + New item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: '#9ca3af',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>
            No scheduled items yet
          </div>
        </div>
      ) : (
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
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                ))}
                {canManage && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                  <td style={tdStyle}>{typeLabel(item.type)}</td>
                  <td style={tdStyle}>
                    <div>{item.time_of_day ? formatTimeOfDay(item.time_of_day) : '—'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {daysOfWeekLabel(item.days_of_week)}
                    </div>
                  </td>
                  <td style={tdStyle}>{item.overdue_window_minutes} min</td>
                  <td style={tdStyle}>{item.is_compulsory ? 'Yes' : 'No'}</td>
                  {canManage && (
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setFormItem(item)}
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
                        <button
                          type="button"
                          onClick={() => setDeleteItem(item)}
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
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formItem !== undefined && (
        <ScheduledItemModal
          careRecipientId={careRecipientId}
          userId={userId}
          item={formItem}
          onClose={() => setFormItem(undefined)}
          onSaved={handleSaved}
        />
      )}

      {deleteItem && (
        <DeleteScheduledItemModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
