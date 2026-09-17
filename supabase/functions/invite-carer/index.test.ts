import { assertEquals } from 'jsr:@std/assert';
import { handler, resolveInvitedUserId } from './index.ts';

const VALID_BODY = {
  email: 'newcarer@test.local',
  role: 'carer',
  care_recipient_id: 'aaaaaaaa-0000-0000-0000-000000000001',
};

function makeRequest(body: unknown, authHeader?: string): Request {
  return new Request('http://localhost/invite-carer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

Deno.test('OPTIONS returns CORS headers', async () => {
  const req = new Request('http://localhost/invite-carer', { method: 'OPTIONS' });
  const res = await handler(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('missing Authorization header returns 401', async () => {
  const req = makeRequest(VALID_BODY);
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'Missing Authorization header');
});

Deno.test('missing email returns 400', async () => {
  const req = makeRequest(
    { role: 'carer', care_recipient_id: VALID_BODY.care_recipient_id },
    'Bearer test-token',
  );
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'email, role, and care_recipient_id are required');
});

Deno.test('missing role returns 400', async () => {
  const req = makeRequest(
    { email: VALID_BODY.email, care_recipient_id: VALID_BODY.care_recipient_id },
    'Bearer test-token',
  );
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'email, role, and care_recipient_id are required');
});

Deno.test('missing care_recipient_id returns 400', async () => {
  const req = makeRequest({ email: VALID_BODY.email, role: 'carer' }, 'Bearer test-token');
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'email, role, and care_recipient_id are required');
});

Deno.test('invalid role returns 400', async () => {
  const req = makeRequest({ ...VALID_BODY, role: 'super_admin' }, 'Bearer test-token');
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'role must be senior_carer or carer');
});

Deno.test('admin role is rejected (not invitable)', async () => {
  const req = makeRequest({ ...VALID_BODY, role: 'admin' }, 'Bearer test-token');
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'role must be senior_carer or carer');
});

Deno.test('redirect_to not on allowlist returns 400', async () => {
  const req = makeRequest(
    { ...VALID_BODY, redirect_to: 'https://evil.example.com/steal' },
    'Bearer test-token',
  );
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'redirect_to is not on the allowlist');
});

Deno.test({
  name: 'redirect_to native scheme is allowed without env var',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Set dummy Supabase env vars so client construction succeeds; handler will return
    // 403 (no real RPC) rather than 400 from the allowlist guard.
    Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
    Deno.env.set('SUPABASE_ANON_KEY', 'fake-anon-key');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fake-service-key');
    try {
      const req = makeRequest(
        { ...VALID_BODY, redirect_to: 'caregiver://setup' },
        'Bearer test-token',
      );
      const res = await handler(req);
      const body = await res.json();
      // Must not be rejected by the allowlist
      if (res.status === 400) {
        assertEquals(body.error === 'redirect_to is not on the allowlist', false);
      }
    } finally {
      Deno.env.delete('SUPABASE_URL');
      Deno.env.delete('SUPABASE_ANON_KEY');
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    }
  },
});

Deno.test({
  name: 'redirect_to web origin allowed when INVITE_WEB_ORIGIN env var set',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const webOrigin = 'https://app.caregiver.example.com/setup';
    Deno.env.set('INVITE_WEB_ORIGIN', webOrigin);
    Deno.env.set('SUPABASE_URL', 'http://localhost:54321');
    Deno.env.set('SUPABASE_ANON_KEY', 'fake-anon-key');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fake-service-key');
    try {
      const req = makeRequest({ ...VALID_BODY, redirect_to: webOrigin }, 'Bearer test-token');
      const res = await handler(req);
      const body = await res.json();
      // Must not be rejected by the allowlist
      if (res.status === 400) {
        assertEquals(body.error === 'redirect_to is not on the allowlist', false);
      }
    } finally {
      Deno.env.delete('INVITE_WEB_ORIGIN');
      Deno.env.delete('SUPABASE_URL');
      Deno.env.delete('SUPABASE_ANON_KEY');
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    }
  },
});

Deno.test('redirect_to web origin rejected when INVITE_WEB_ORIGIN env var not set', async () => {
  Deno.env.delete('INVITE_WEB_ORIGIN');
  const req = makeRequest(
    { ...VALID_BODY, redirect_to: 'https://app.caregiver.example.com/setup' },
    'Bearer test-token',
  );
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, 'redirect_to is not on the allowlist');
});

// ── resolveInvitedUserId ─────────────────────────────────────────────────────
// Unit tests for the invite-vs-reuse decision, isolated from the network.

Deno.test('existing user: reuses the existing id and does not invite', async () => {
  let inviteCalled = false;
  const result = await resolveInvitedUserId({
    email: 'existing@test.local',
    redirectTo: 'caregiver://setup',
    lookupExistingUserId: async () => 'existing-user-id',
    inviteUser: async () => {
      inviteCalled = true;
      return { id: 'should-not-be-used' };
    },
  });

  assertEquals(result, { userId: 'existing-user-id', invited: false });
  assertEquals(inviteCalled, false, 'inviteUser must not be called when the user already exists');
});

Deno.test('new user: invites and returns the invited id', async () => {
  let lookedUpEmail: string | undefined;
  let invitedWith: { email: string; redirectTo: string } | undefined;

  const result = await resolveInvitedUserId({
    email: 'newcarer@test.local',
    redirectTo: 'caregiver://setup',
    lookupExistingUserId: async (email) => {
      lookedUpEmail = email;
      return null;
    },
    inviteUser: async (email, redirectTo) => {
      invitedWith = { email, redirectTo };
      return { id: 'invited-user-id' };
    },
  });

  assertEquals(result, { userId: 'invited-user-id', invited: true });
  assertEquals(lookedUpEmail, 'newcarer@test.local');
  assertEquals(invitedWith, { email: 'newcarer@test.local', redirectTo: 'caregiver://setup' });
});

Deno.test('lookup failure propagates instead of falling through to invite', async () => {
  let inviteCalled = false;
  let threw = false;
  try {
    await resolveInvitedUserId({
      email: 'broken@test.local',
      redirectTo: 'caregiver://setup',
      lookupExistingUserId: async () => {
        throw new Error('lookup boom');
      },
      inviteUser: async () => {
        inviteCalled = true;
        return { id: 'unused' };
      },
    });
  } catch (err) {
    threw = true;
    assertEquals((err as Error).message, 'lookup boom');
  }
  assertEquals(threw, true, 'expected lookup error to propagate');
  assertEquals(inviteCalled, false);
});
