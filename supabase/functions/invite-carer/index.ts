import { createClient } from 'jsr:@supabase/supabase-js@2';

const REDIRECT_TO = 'caregiver://setup';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client scoped to the calling user — used to verify their role.
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Service-role client — used for the admin invite API.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { email, role, care_recipient_id } = await req.json() as {
    email: string;
    role: 'senior_carer' | 'carer';
    care_recipient_id: string;
  };

  if (!email || !role || !care_recipient_id) {
    return json({ error: 'email, role, and care_recipient_id are required' }, 400);
  }
  if (!['senior_carer', 'carer'].includes(role)) {
    return json({ error: 'role must be senior_carer or carer' }, 400);
  }

  // Verify the caller is an admin for this care_recipient.
  const { data: isAdmin, error: roleCheckError } = await callerClient
    .rpc('is_admin_for', { p_care_recipient_id: care_recipient_id });

  if (roleCheckError || !isAdmin) {
    return json({ error: 'Forbidden: caller is not an admin for this care recipient' }, 403);
  }

  // Send the invite email via Supabase Auth admin API.
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: REDIRECT_TO },
  );

  if (inviteError) {
    return json({ error: inviteError.message }, 400);
  }

  const invitedUserId = inviteData.user.id;

  // Assign the role. Use upsert to handle re-invites gracefully.
  const { error: roleInsertError } = await adminClient
    .from('user_roles')
    .upsert(
      { user_id: invitedUserId, care_recipient_id, role },
      { onConflict: 'user_id,care_recipient_id' },
    );

  if (roleInsertError) {
    return json({ error: `User invited but role assignment failed: ${roleInsertError.message}` }, 500);
  }

  return json({ success: true, user_id: invitedUserId });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
