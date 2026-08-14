import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TodayTimeline from './components/TodayTimeline';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('care_recipient_id')
    .eq('user_id', user.id)
    .single();

  const careRecipientId = roleData?.care_recipient_id;

  if (!careRecipientId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Today</h1>
        <p className="mt-2 text-sm text-neutral-500">No care recipient assigned to your account.</p>
      </div>
    );
  }

  const now = new Date();
  const todayDow = now.getDay();
  const todayUTCStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrowUTCStart = new Date(todayUTCStart.getTime() + 86_400_000);

  const [itemsResult, eventsResult, carerNamesResult, prnMedicationsResult] = await Promise.all([
    supabase
      .from('scheduled_items')
      .select('id, type, name, time_of_day, overdue_window_minutes, days_of_week')
      .eq('care_recipient_id', careRecipientId)
      .not('time_of_day', 'is', null)
      .order('time_of_day', { ascending: true }),

    supabase
      .from('event_log')
      .select('id, scheduled_item_id, carer_id, occurred_at, status, event_type')
      .eq('care_recipient_id', careRecipientId)
      .gte('occurred_at', todayUTCStart.toISOString())
      .lt('occurred_at', tomorrowUTCStart.toISOString()),

    supabase.rpc('get_carer_names', { p_care_recipient_id: careRecipientId }),

    supabase
      .from('as_needed_medications')
      .select('id, name, notes')
      .eq('care_recipient_id', careRecipientId)
      .order('name', { ascending: true }),
  ]);

  const scheduledItems = (itemsResult.data ?? []).filter(
    (item) => item.days_of_week === null || item.days_of_week.includes(todayDow),
  );

  const todayLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <TodayTimeline
      careRecipientId={careRecipientId}
      carerId={user.id}
      scheduledItems={scheduledItems}
      initialEvents={eventsResult.data ?? []}
      carerNames={carerNamesResult.data ?? []}
      asNeededMedications={prnMedicationsResult.data ?? []}
      serverTimeISO={now.toISOString()}
      todayLabel={todayLabel}
    />
  );
}
