import { createClient } from 'jsr:@supabase/supabase-js@2';

const NATIVE_REDIRECT = 'caregiver://setup';

// Distinguishes an existing-user lookup failure (our DB/RPC, a server fault)
// from an inviteUserByEmail rejection (bad input, a client fault) so the
// handler can map each to the right HTTP status.
class LookupFailedError extends Error {}

function buildAllowlist(): string[] {
  const allowlist = [NATIVE_REDIRECT];
  const webOrigin = Deno.env.get('INVITE_WEB_ORIGIN');
  if (webOrigin) allowlist.push(webOrigin);
  return allowlist;
}

// Decides whether to reuse an existing User or send a fresh invite. Pulled
// out as its own seam so the branching can be unit tested without a live
// Supabase instance — lookupExistingUserId/inviteUser are the only things
// that touch the network.
export async function resolveInvitedUserId(params: {
  email: string;
  redirectTo: string;
  lookupExistingUserId: (email: string) => Promise<string | null>;
  inviteUser: (email: string, redirectTo: string) => Promise<{ id: string }>;
}): Promise<{ userId: string; invited: boolean }> {
  const existingUserId = await params.lookupExistingUserId(params.email);
  if (existingUserId) {
    return { userId: existingUserId, invited: false };
  }

  const invitedUser = await params.inviteUser(params.email, params.redirectTo);
  return { userId: invitedUser.id, invited: true };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const { email, role, care_recipient_id, redirect_to } = (await req.json()) as {
    email: string;
    role: 'senior_carer' | 'carer';
    care_recipient_id: string;
    redirect_to?: string;
  };

  if (!email || !role || !care_recipient_id) {
    return json({ error: 'email, role, and care_recipient_id are required' }, 400);
  }
  if (!['senior_carer', 'carer'].includes(role)) {
    return json({ error: 'role must be senior_carer or carer' }, 400);
  }

  const allowlist = buildAllowlist();
  const redirectTo = redirect_to ?? NATIVE_REDIRECT;

  if (!allowlist.includes(redirectTo)) {
    return json({ error: 'redirect_to is not on the allowlist' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client scoped to the calling user — used to verify their role.
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  // Service-role client — used for the admin invite API.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller is an admin for this care_recipient.
  const { data: isAdmin, error: roleCheckError } = await callerClient.rpc('is_admin_for', {
    p_care_recipient_id: care_recipient_id,
  });

  if (roleCheckError || !isAdmin) {
    return json({ error: 'Forbidden: caller is not an admin for this care recipient' }, 403);
  }

  // If a User already exists for this email, reuse it instead of inviting —
  // inviteUserByEmail errors on an email that already has an account.
  const lookupExistingUserId = async (lookupEmail: string): Promise<string | null> => {
    const { data, error } = await adminClient.rpc('get_user_id_by_email', {
      p_email: lookupEmail,
    });
    if (error) throw new LookupFailedError(error.message);
    return (data as string | null) ?? null;
  };

  const inviteUser = async (inviteEmail: string, inviteRedirectTo: string) => {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(inviteEmail, {
      redirectTo: inviteRedirectTo,
    });
    if (error) throw error;
    return data.user;
  };

  let userId: string;
  let invited: boolean;
  try {
    const resolved = await resolveInvitedUserId({
      email,
      redirectTo,
      lookupExistingUserId,
      inviteUser,
    });
    userId = resolved.userId;
    invited = resolved.invited;
  } catch (err) {
    if (err instanceof LookupFailedError) {
      return json({ error: `Failed to check for existing user: ${err.message}` }, 500);
    }
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }

  // Assign the role. Use upsert to handle re-invites and existing users gracefully.
  const { error: roleInsertError } = await adminClient
    .from('user_roles')
    .upsert(
      { user_id: userId, care_recipient_id, role },
      { onConflict: 'user_id,care_recipient_id' },
    );

  if (roleInsertError) {
    const action = invited ? 'User invited' : 'Existing user found';
    return json({ error: `${action} but role assignment failed: ${roleInsertError.message}` }, 500);
  }

  return json({ success: true, user_id: userId });
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
