-- Lets the invite-carer edge function check whether a User already exists
-- for an invitee's email, so it can upsert a Role directly instead of
-- erroring on inviteUserByEmail (#108). SECURITY DEFINER to reach
-- auth.users; execute is revoked from anon/authenticated below since
-- exposing this via RPC would let any client enumerate registered emails.
-- Only the service role (used by the edge function) may call it.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
