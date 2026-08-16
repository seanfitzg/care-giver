'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CarerName } from '../components/types';
import {
  eventTypeLabel,
  formatOccurredAt,
  LOG_ENTRY_COLUMNS,
  PAGE_SIZE,
  statusLabel,
  TYPE_FILTER_OPTIONS,
  type LogEntry,
  type LogTypeFilter,
} from './types';

interface Props {
  careRecipientId: string;
  initialEntries: LogEntry[];
  initialCount: number;
}

interface NutritionDetail {
  bolus_rounds_completed: number | null;
  all_consumed: boolean | null;
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
  verticalAlign: 'top',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13.5,
  fontFamily: 'inherit',
};

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color,
  marginLeft: 6,
  whiteSpace: 'nowrap',
});

export default function LogTable({ careRecipientId, initialEntries, initialCount }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>(initialEntries);
  const [count, setCount] = useState(initialCount);
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<LogTypeFilter | ''>('');
  const [loading, setLoading] = useState(false);
  const [carerMap, setCarerMap] = useState<Map<string, string>>(new Map());
  const [nutritionMap, setNutritionMap] = useState<Map<string, NutritionDetail>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc('get_carer_names', { p_care_recipient_id: careRecipientId })
      .then(({ data }: { data: CarerName[] | null }) => {
        if (data) setCarerMap(new Map(data.map((c) => [c.user_id, c.display_name])));
      });
  }, [careRecipientId]);

  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (page === 0 && !typeFilter && !dateFrom && !dateTo) return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from('event_log')
        .select(LOG_ENTRY_COLUMNS, { count: 'exact' })
        .eq('care_recipient_id', careRecipientId)
        .order('occurred_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (typeFilter === 'missed') {
        query = query.eq('status', 'missed');
      } else if (typeFilter) {
        query = query.eq('event_type', typeFilter).neq('status', 'missed');
      }
      if (dateFrom) query = query.gte('occurred_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('occurred_at', `${dateTo}T23:59:59.999`);

      const { data, count: totalCount } = await query;
      if (cancelled) return;

      setEntries((data ?? []) as LogEntry[]);
      setCount(totalCount ?? 0);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [careRecipientId, page, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    const nutritionTimestamps = entries
      .filter((e) => e.event_type === 'nutrition' && e.status === 'completed')
      .map((e) => e.occurred_at);

    let cancelled = false;
    const supabase = createClient();
    const fetchSessions =
      nutritionTimestamps.length === 0
        ? Promise.resolve({
            data: [] as {
              completed_at: string | null;
              bolus_rounds_completed: number | null;
              all_consumed: boolean | null;
            }[],
          })
        : supabase
            .from('nutrition_sessions')
            .select('completed_at, bolus_rounds_completed, all_consumed')
            .eq('care_recipient_id', careRecipientId)
            .in('completed_at', nutritionTimestamps);

    fetchSessions.then(({ data: sessions }) => {
      if (cancelled || !sessions) return;
      setNutritionMap(
        new Map(
          sessions
            .filter((s) => s.completed_at)
            .map((s) => [
              s.completed_at as string,
              { bolus_rounds_completed: s.bolus_rounds_completed, all_consumed: s.all_consumed },
            ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [careRecipientId, entries]);

  function handleFilterChange(fn: () => void) {
    fn();
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const rangeStart = count === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(count, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Care log</h1>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleFilterChange(() => setDateFrom(e.target.value))}
            style={{ ...inputStyle, display: 'block', marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleFilterChange(() => setDateTo(e.target.value))}
            style={{ ...inputStyle, display: 'block', marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
          Event type
          <select
            value={typeFilter}
            onChange={(e) =>
              handleFilterChange(() => setTypeFilter(e.target.value as LogTypeFilter | ''))
            }
            style={{ ...inputStyle, display: 'block', marginTop: 4 }}
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {(dateFrom || dateTo || typeFilter) && (
          <button
            type="button"
            onClick={() =>
              handleFilterChange(() => {
                setDateFrom('');
                setDateTo('');
                setTypeFilter('');
              })
            }
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {entries.length === 0 ? (
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
          <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>
            {loading ? 'Loading…' : 'No events match these filters'}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            overflowX: 'auto',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Date / time</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Carer</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Notes</th>
                <th style={thStyle}>Feeding</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const missed = entry.status === 'missed';
                const nutrition =
                  entry.event_type === 'nutrition'
                    ? nutritionMap.get(entry.occurred_at)
                    : undefined;
                return (
                  <tr
                    key={entry.id}
                    style={
                      missed
                        ? { background: '#fef2f2', boxShadow: 'inset 3px 0 0 0 #dc2626' }
                        : undefined
                    }
                  >
                    <td style={tdStyle}>{formatOccurredAt(entry.occurred_at)}</td>
                    <td style={tdStyle}>{eventTypeLabel(entry.event_type)}</td>
                    <td style={tdStyle}>
                      {entry.carer_id ? (carerMap.get(entry.carer_id) ?? '—') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          color: missed ? '#dc2626' : undefined,
                          fontWeight: missed ? 600 : undefined,
                        }}
                      >
                        {statusLabel(entry.status)}
                      </span>
                      {entry.bulk_confirmed && (
                        <span style={badgeStyle('#eef2ff', '#4338ca')}>Bulk confirmed</span>
                      )}
                    </td>
                    <td style={tdStyle}>{entry.notes || '—'}</td>
                    <td style={tdStyle}>
                      {entry.event_type !== 'nutrition' ? (
                        '—'
                      ) : nutrition ? (
                        <>
                          <div>
                            {nutrition.bolus_rounds_completed !== null
                              ? `${nutrition.bolus_rounds_completed} bolus round${nutrition.bolus_rounds_completed === 1 ? '' : 's'}`
                              : '—'}
                          </div>
                          {nutrition.all_consumed !== null && (
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {nutrition.all_consumed ? 'All consumed' : 'Not all consumed'}
                            </div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14,
          fontSize: 13,
          color: '#6b7280',
        }}
      >
        <span>{count === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${count}`}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: page === 0 || loading ? 'not-allowed' : 'pointer',
              opacity: page === 0 || loading ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: page + 1 >= totalPages || loading ? 'not-allowed' : 'pointer',
              opacity: page + 1 >= totalPages || loading ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
