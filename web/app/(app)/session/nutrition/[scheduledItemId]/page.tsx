import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireActivePatient } from '@/lib/patients';
import NutritionSessionRunner from './NutritionSessionRunner';

export default async function NutritionSessionPage({
  params,
}: {
  params: Promise<{ scheduledItemId: string }>;
}) {
  const { scheduledItemId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { careRecipientId } = await requireActivePatient(user.id);

  const { data: scheduledItem } = await supabase
    .from('scheduled_items')
    .select('id, name, description, nutrition_type, bolus_rest_minutes')
    .eq('id', scheduledItemId)
    .eq('care_recipient_id', careRecipientId)
    .eq('type', 'nutrition')
    .single();

  if (!scheduledItem) notFound();

  // Scoped to the current carer: nutrition_sessions_update RLS only allows the
  // owning carer (or an admin) to update a row, so resuming another carer's
  // still-open session would leave every action in the runner silently rejected.
  const { data: existingSession } = await supabase
    .from('nutrition_sessions')
    .select(
      'id, care_recipient_id, scheduled_item_id, carer_id, started_at, completed_at, all_consumed, notes, bolus_rest_minutes, bolus_rounds_completed, rest_started_at',
    )
    .eq('scheduled_item_id', scheduledItemId)
    .eq('carer_id', user.id)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <NutritionSessionRunner
      scheduledItem={scheduledItem}
      careRecipientId={careRecipientId}
      carerId={user.id}
      existingSession={existingSession ?? null}
      serverTimeISO={new Date().toISOString()}
    />
  );
}
