# Self-serve Sign Up decoupled from Care Recipient creation

The app was originally invite-only end-to-end: every User was created by an existing Admin inviting them to a specific Care Recipient, so "having an account" and "having a Role somewhere" always happened atomically. With the DB reset to zero Users, there was no way for anyone — including a would-be first Admin — to get back in. We're adding self-serve Sign Up (email, password, display name) that creates a User with no Care Recipient at all; from there they either create their own new Care Recipient (becoming its Admin, via the existing `create_care_recipient` RPC, which was already unrestricted to any authenticated caller) or wait to be Invited to someone else's. Invite-only is preserved for _joining an existing_ Care Recipient — only _account creation_ and _starting a brand-new_ Care Recipient became self-serve.

**Considered options:**

- Combine Sign Up and Care Recipient creation into one screen/step — rejected: less flexible, and forces every new User into owning a Care Recipient immediately even when they're about to be invited into someone else's instead.
- Keep account creation admin-only (an internal tool, no public entry point) — rejected: doesn't solve "nobody can log in" today, and doesn't match the self-serve, multi-tenant nature `create_care_recipient`'s lack of restriction already implied.

**Consequences:** `invite-carer` must check for an existing User by email before calling Supabase's `inviteUserByEmail` (which errors on an existing account) and upsert the Role assignment directly if one is found, since Invite and Sign Up can now independently target the same email.
