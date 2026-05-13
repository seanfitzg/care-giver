import { createClient } from 'jsr:@supabase/supabase-js@2';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  // Only the service role may trigger this function (pg_cron uses the service key).
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

  try {
    const { data, error } = await supabase.rpc('mark_missed_events');
    if (error) throw error;

    const entries =
      (data as Array<{
        inserted_id: string;
        item_id: string;
        item_care_recipient_id: string;
        item_event_type: string;
      }>) ?? [];

    console.log(`mark-missed-events: inserted ${entries.length} missed entries`);
    return json({ success: true, missed_count: entries.length, entries });
  } catch (err) {
    console.error('mark-missed-events error:', err);
    return json({ error: String(err) }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

Deno.serve(handler);
