/**
 * Integration tests for mark_missed_events().
 * Run against a local Supabase instance:
 *   deno test --allow-env --allow-net supabase/functions/mark-missed-events/index.test.ts
 */

import { assertEquals } from 'jsr:@std/assert';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54421';
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────

async function seedRecipient(): Promise<string> {
  const { data, error } = await db
    .from('care_recipients')
    .insert({ name: 'Test Child', date_of_birth: '2020-01-01' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function seedScheduledItem(
  careRecipientId: string,
  timeOfDay: string,
  overdueWindowMinutes: number,
  type: 'medication_scheduled' | 'nutrition' | 'activity' = 'medication_scheduled',
  isCompulsory = true,
): Promise<string> {
  // created_by is required — use a throwaway auth user UUID that satisfies the FK.
  // In local dev the seed user from seed.sql suffices; here we grab the first user.
  const { data: userRow } = await db.from('user_roles').select('user_id').limit(1).single();
  const userId = userRow?.user_id ?? '00000000-0000-0000-0000-000000000000';

  const { data, error } = await db
    .from('scheduled_items')
    .insert({
      care_recipient_id: careRecipientId,
      type,
      name: 'Test item',
      time_of_day: timeOfDay,
      overdue_window_minutes: overdueWindowMinutes,
      is_compulsory: isCompulsory,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertEvent(
  careRecipientId: string,
  scheduledItemId: string,
  status: 'completed' | 'missed' | 'skipped',
  eventType: 'medication_scheduled' | 'nutrition' | 'activity' = 'medication_scheduled',
): Promise<void> {
  const { error } = await db.from('event_log').insert({
    care_recipient_id: careRecipientId,
    event_type: eventType,
    scheduled_item_id: scheduledItemId,
    occurred_at: new Date().toISOString(),
    status,
  });
  if (error) throw error;
}

async function countMissedEvents(scheduledItemId: string): Promise<number> {
  const { count, error } = await db
    .from('event_log')
    .select('*', { count: 'exact', head: true })
    .eq('scheduled_item_id', scheduledItemId)
    .eq('status', 'missed');
  if (error) throw error;
  return count ?? 0;
}

async function cleanup(careRecipientId: string): Promise<void> {
  // Cascade deletes take care of child rows.
  await db.from('care_recipients').delete().eq('id', careRecipientId);
}

async function runMarkMissed(): Promise<Array<{ item_id: string }>> {
  const { data, error } = await db.rpc('mark_missed_events');
  if (error) throw error;
  return (data as Array<{ item_id: string }>) ?? [];
}

// ── tests ────────────────────────────────────────────────────────────────────

Deno.test('item past threshold with no completion → missed entry written', async () => {
  const recipientId = await seedRecipient();
  try {
    // time_of_day well in the past; overdue_window = 1 min so threshold is passed
    const itemId = await seedScheduledItem(recipientId, '00:00:00', 1);

    const result = await runMarkMissed();
    const inserted = result.filter((r) => r.item_id === itemId);
    assertEquals(inserted.length, 1, 'expected one missed entry');

    const count = await countMissedEvents(itemId);
    assertEquals(count, 1, 'missed entry should exist in event_log');
  } finally {
    await cleanup(recipientId);
  }
});

Deno.test('item past threshold with completion → no missed entry', async () => {
  const recipientId = await seedRecipient();
  try {
    const itemId = await seedScheduledItem(recipientId, '00:00:00', 1);
    await insertEvent(recipientId, itemId, 'completed');

    const result = await runMarkMissed();
    const inserted = result.filter((r) => r.item_id === itemId);
    assertEquals(inserted.length, 0, 'should not insert missed when completed');

    const count = await countMissedEvents(itemId);
    assertEquals(count, 0);
  } finally {
    await cleanup(recipientId);
  }
});

Deno.test('function is idempotent — running twice does not create duplicate entries', async () => {
  const recipientId = await seedRecipient();
  try {
    const itemId = await seedScheduledItem(recipientId, '00:00:00', 1);

    await runMarkMissed();
    await runMarkMissed();

    const count = await countMissedEvents(itemId);
    assertEquals(count, 1, 'exactly one missed entry even when called twice');
  } finally {
    await cleanup(recipientId);
  }
});

Deno.test('item past threshold with skipped entry → no missed entry', async () => {
  const recipientId = await seedRecipient();
  try {
    const itemId = await seedScheduledItem(recipientId, '00:00:00', 1);
    await insertEvent(recipientId, itemId, 'skipped');

    const result = await runMarkMissed();
    const inserted = result.filter((r) => r.item_id === itemId);
    assertEquals(inserted.length, 0, 'should not insert missed when skipped');
  } finally {
    await cleanup(recipientId);
  }
});

Deno.test(
  'non-compulsory item past threshold → missed entry written (distinguishable via is_compulsory)',
  async () => {
    const recipientId = await seedRecipient();
    try {
      const itemId = await seedScheduledItem(
        recipientId,
        '00:00:00',
        1,
        'medication_scheduled',
        false,
      );

      const result = await runMarkMissed();
      const inserted = result.filter((r) => r.item_id === itemId);
      assertEquals(inserted.length, 1, 'non-compulsory items still get a missed entry');

      // Verify the scheduled item's is_compulsory flag is readable for distinction
      const { data: item } = await db
        .from('scheduled_items')
        .select('is_compulsory')
        .eq('id', itemId)
        .single();
      assertEquals(
        item?.is_compulsory,
        false,
        'is_compulsory = false distinguishes supplement in log',
      );
    } finally {
      await cleanup(recipientId);
    }
  },
);
