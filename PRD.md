# PRD: care-giver — Care Coordination App

## Problem Statement

Parents and carers of children with complex medical needs must coordinate medication schedules, PEG feeding sessions, and therapy activities across multiple caregivers throughout the day. There is no shared, real-time record of what has been done, what is overdue, and who is currently responsible. Missed medications, incorrect feeding schedules, or lack of visibility into care history create serious risk for the child and stress for the family.

## Solution

A multi-tenant mobile app and dedicated web portal that gives families a shared, real-time care coordination tool. The admin (parent) configures a schedule of medications, feeding sessions, and activities. On-duty carers receive push notifications and in-app alerts when tasks are due. Every action is logged against the carer who performed it, creating a full, auditable care history. Carers check in and out of duty, ensuring notifications are routed only to the person currently responsible.

## User Stories

### Authentication & Onboarding
1. As an admin, I want to create a care recipient profile, so that all schedules and logs are scoped to my child.
2. As an admin, I want to invite carers by email, so that they can access the app without me sharing credentials.
3. As an admin, I want to assign a role (Senior Carer or Carer) when inviting someone, so that access levels are set from the start.
4. As an invited carer, I want to receive an email with a secure setup link, so that I can create my account and access the app.
5. As an admin, I want to revoke a carer's access, so that former carers can no longer view or record care events.
6. As any user, I want to log in securely with my email and password, so that care records are protected.

### Duty Management
7. As a carer, I want to check in when I arrive, so that I start receiving notifications for the child I am caring for.
8. As a carer, I want to check out when I leave, so that I stop receiving notifications after my shift.
9. As an admin, I want to always be considered on-duty without checking in, so that I never miss a notification.
10. As an admin, I want to see who is currently on duty, so that I know which carers are actively responsible.
11. As a carer, I want to see who else is currently on duty, so that I can coordinate during handovers.
12. As an admin, I want to check a carer in or out from the duty screen, so that I can correct the duty state when a carer forgets.

### Schedule Management
13. As an admin or senior carer, I want to create a scheduled medication with a fixed daily time, so that carers are reminded to administer it.
14. As an admin or senior carer, I want to flag a medication as a supplement (non-compulsory), so that a missed dose is treated less critically than a compulsory medication.
15. As an admin or senior carer, I want to set a per-medication overdue window, so that the system accounts for medications with different time tolerances.
16. As an admin or senior carer, I want to set a per-medication missed threshold, so that a dose is marked missed only after an appropriate delay.
17. As an admin or senior carer, I want to create a feeding schedule with a configurable interval between sessions, so that the daily feed count and timing match clinical guidance.
18. As an admin or senior carer, I want to set the bolus rest duration (e.g. 20 or 25 minutes) per feeding schedule, so that the countdown timer matches the protocol prescribed for this child.
19. As an admin or senior carer, I want to configure a generic scheduled activity (e.g. stander time) with a time and duration, so that therapy tasks are also tracked.
20. As an admin or senior carer, I want to edit or delete any scheduled item, so that the schedule stays accurate as care needs change.
21. As an admin or senior carer, I want to set the overdue and missed windows for feeding sessions and activities independently, so that flexibility matches clinical guidance.

### Feeding Session
22. As an on-duty carer, I want to start a guided feeding session, so that I am walked through each bolus and rest period.
23. As an on-duty carer, I want to see a countdown timer for the configured rest period (20 or 25 minutes) between bolus rounds, so that I know when to resume feeding.
24. As an on-duty carer, I want the rest duration to reflect the value set in the feeding schedule, so that I follow the correct protocol without having to remember it.
25. As an on-duty carer, I want to skip the rest period early if the child is ready, so that I am not forced to wait for the timer when it is clinically appropriate to proceed.
26. As an on-duty carer, I want to record the start time of a feeding session automatically, so that I do not need to enter it manually.
27. As an on-duty carer, I want to see an elapsed-time counter during an active session, so that I can track how long the overall feed is taking.
28. As an on-duty carer, I want the number of bolus rounds completed to be recorded when I end a session, so that the log shows how much of the feed was given.
29. As an on-duty carer, I want to record the end time of a feeding session when I mark it complete, so that the full duration is captured.
30. As an on-duty carer, I want to add a note to a feeding session, so that I can record if a feed was incomplete or the child showed discomfort.
31. As an on-duty carer, I want the feeding session log to record which carer administered it, so that there is an accurate audit trail.
32. As an on-duty carer, I want to abandon a feeding session with a confirmation step, so that an incomplete session is recorded and I am not returned to the timeline by accident.

### Medication Recording
33. As an on-duty carer, I want to mark a scheduled medication as given, so that other carers know it has been administered.
34. As an on-duty carer, I want to record an as-needed medication at any time, so that ad-hoc doses are always captured.
35. As an on-duty carer, I want to add a note when recording any medication, so that I can capture context (e.g. child refused, partial dose).
36. As any user, I want to see which carer recorded each medication event, so that accountability is clear.

### Activity Recording
37. As an on-duty carer, I want to mark a scheduled activity as complete, so that the log reflects what has been done.
38. As an on-duty carer, I want to add a note when completing an activity, so that I can record observations.

### Notifications & Alerts
39. As an on-duty carer, I want to receive a push notification when a task is due, so that I am reminded even when the app is in the background.
40. As an on-duty carer, I want to see a prominent in-app alert for any overdue task, so that nothing is missed when I open the app.
41. As an on-duty carer, I want overdue tasks to be visually distinct (e.g. red) in the timeline, so that I can prioritise at a glance.
42. As an on-duty carer, I want to see a "missed" label on tasks that passed their missed threshold without being completed, so that the record is accurate.
43. As a user, I want to see a clear connectivity warning when the app is offline, so that I know notifications may not be reliable.
44. As an off-duty carer, I want to receive no notifications, so that I am not disturbed outside my shift.

### Bulk Catch-Up
45. As an on-duty carer, I want to mark all overdue events as complete in one action, so that I can quickly catch up the app record after a period of care without logging.
46. As an on-duty carer, I want to add a single note that applies to the entire bulk catch-up, so that I can record context (e.g. "carer was present, app not used") without repeating it for each event.
47. As any user, I want bulk-confirmed events to be visually distinguishable in the history log, so that it is clear they were confirmed together rather than individually at the time.
48. As an admin, I want bulk-confirmed events to be attributed to the carer who performed the catch-up, so that accountability is maintained even when recording was delayed.

### Timeline View
50. As an on-duty carer, I want to see a rolling timeline of today's tasks (past and upcoming), so that I have a full picture of the care day.
51. As an on-duty carer, I want the timeline window to be configurable (e.g. past 2 hours, next 6 hours), so that it matches my working style.
52. As any user, I want completed tasks to be visually distinct from pending tasks in the timeline, so that I can see progress at a glance.
53. As any user, I want overdue tasks to appear prominently at the top of the timeline, so that urgent items are never buried.

### History & Log
54. As an admin, I want to view a log of all care events for any date range, so that I can review what happened over time.
55. As any user, I want to filter the log by event type (medication, feeding, activity, missed), so that I can find specific records quickly.
56. As any user, I want each log entry to show the carer, the time, any notes, and (for feeding sessions) the number of bolus rounds completed, so that the record is complete.
57. As an admin, I want to see missed events in the log, so that gaps in care are visible.

### Platform & Device Support
58. As a carer, I want to use the app on my iPhone, so that I can act on reminders while moving around the house.
59. As a carer, I want to use the app on my Android phone, so that I am not required to own an Apple device.
60. As an admin, I want to use the app on an iPad, so that I have a larger screen for reviewing the schedule and care history.
61. As an admin or carer, I want to access a dedicated web portal from a desktop or laptop browser, so that I can coordinate care without needing a mobile device.
62. As an admin, I want schedule management and history review to be optimised for desktop use in the web portal, so that managing complex schedules is easier on a larger screen.
63. As an on-duty carer, I want to receive web push notifications in the browser, so that I am reminded of due tasks even when I am using the portal on a desktop.
64. As any user, I want my login session to work consistently between the mobile app and the web portal, so that I do not need separate credentials.

### Multi-Tenancy
61. As an admin, I want my family's data to be completely isolated from other families using the app, so that privacy is maintained.
62. As an admin, I want to set up a care recipient profile with a name and date of birth, so that the app is personalised.

---

## Implementation Decisions

### Modules

**Auth & Roles**
- Supabase Auth handles all authentication (email/password, invite flow).
- Three roles: Admin, Senior Carer, Carer — stored in a `user_roles` table scoped to a care recipient.
- Admins are always considered on-duty; no check-in logic applies to them.
- Role is assigned at invite time; admins can change a user's role after the fact.

**Care Recipient (Multi-Tenancy)**
- A `care_recipients` table is the root tenant. All schedules, logs, duty records, and carer assignments are foreign-keyed to a `care_recipient_id`.
- An admin can have one care recipient initially; the schema supports multiple in future.
- Row-level security (RLS) in Supabase enforces isolation between families.

**Carer Duty**
- A `duty_sessions` table records check-in and check-out timestamps per carer per care recipient.
- An open session (no check-out) means the carer is on-duty.
- Admins have a synthetic always-on-duty status — no duty session required.
- "On-duty" is resolved at notification dispatch time by querying open duty sessions + admin role.
- Admins can manually open or close a duty session for any carer from the duty screen.

**Schedule Engine**
- A `scheduled_items` table stores all recurring tasks with a `type` field: `medication_scheduled`, `feeding`, `activity`.
- Each item has: `time_of_day` (for fixed), `interval_minutes` (for feeding), `recurrence` (daily by default, day-of-week mask for future use), `overdue_window_minutes`, `missed_threshold_minutes`, `is_compulsory` (medications only).
- Feeding items additionally carry a `bolus_rest_minutes` field (configurable; typical values 20 or 25) that drives the countdown timer in the session runner.
- A separate `as_needed_medications` table stores ad-hoc medication definitions that can be logged at any time.
- Schedule CRUD is restricted to Admin and Senior Carer roles via RLS.

**Session Runner**
- Feeding sessions are guided flows, not simple checkboxes.
- A `feeding_sessions` table records `started_at`, `completed_at`, `carer_id`, `care_recipient_id`, `notes`, and `bolus_rounds_completed` (integer).
- The bolus/rest cycle is driven client-side with a countdown timer whose duration comes from `bolus_rest_minutes` on the schedule item. Carers may skip the rest period early.
- Each time a carer marks a bolus round done, the client increments the local round counter. On session end or abandon, the final count is written to `bolus_rounds_completed`.
- A session can be abandoned (with confirmation) and marked as incomplete via notes; `bolus_rounds_completed` captures however many rounds were given before abandonment.
- Elapsed session time is shown in the UI but not separately persisted — it is derivable from `started_at` / `completed_at`.

**Event Log**
- An `event_log` table is append-only — no updates or deletes.
- Every completion, skip, missed event, and as-needed medication record writes a row: `event_type`, `scheduled_item_id` (nullable for as-needed), `carer_id`, `occurred_at`, `status` (`completed`, `missed`, `skipped`), `notes`.
- Missed events are written by a scheduled background job (Supabase Edge Function) that runs every minute and flags items past their missed threshold with no corresponding completion event.

**Notification Service**
- Expo Push Notifications for mobile; Web Push API (service worker) for the web portal.
- Device tokens stored in a `push_tokens` table, linked to `user_id`, with a `token_type` column (`expo` or `web`) so the dispatch Edge Function uses the correct service.
- Notifications dispatched via a Supabase Edge Function triggered on a schedule (every minute).
- At dispatch time, the function resolves on-duty carers, finds due items, and sends to their registered tokens.
- In-app alerts are driven by a Supabase Realtime subscription on the `event_log` and `scheduled_items` tables.

**Timeline View**
- Client-side view, built from scheduled items + event log.
- Rolling window defaults configurable per user (stored in user preferences).
- Overdue items (past due, not completed, within missed threshold) float to the top.
- Missed items shown in place with a "missed" badge.

**As-Needed Recorder**
- A dedicated screen allows carers to log any as-needed medication at the current time.
- Records written directly to `event_log` with `event_type = as_needed_medication`.

**Bulk Catch-Up**
- Available from the timeline whenever one or more overdue events exist.
- Scope: all scheduled events that are currently overdue (past their due time, not yet completed, and not yet past their missed threshold). Events already marked missed are excluded — they cannot be retroactively completed via bulk catch-up.
- The carer confirms the action in a single bottom-sheet, optionally entering a shared note (e.g. "carer present, app not used").
- One event log entry is written per event, each with `status = completed`, `carer_id` of the acting carer, `occurred_at` set to the scheduled time of the event (not the current wall-clock time), and a `bulk_confirmed = true` flag so the log can distinguish these from individually confirmed events.
- Feeding sessions are included in bulk catch-up. A `feeding_sessions` record is created with `started_at` and `completed_at` both set to the scheduled time, the shared note, and `bolus_rounds_completed = null` (the carer was not recording step-by-step, so the round count is unknown).
- The `bulk_confirmed` flag is a boolean column on both `event_log` and `feeding_sessions`; it is nullable/false for all individually recorded events.

### Architecture
- **Mobile app**: React Native + Expo (TypeScript), targeting iPhone, iPad, and Android. iPad layout should make good use of the larger screen rather than simply scaling the phone layout.
- **Web portal**: A separate React (TypeScript) application sharing the same Supabase backend. It is a dedicated web app optimised for desktop/laptop browsers — not Expo Web or a mobile web view. It must reach feature parity with the mobile app: timeline, duty management, schedule management, history log, feeding session runner, and all recording flows.
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions, Row-Level Security). The same schema, RLS policies, and Edge Functions serve both frontends.
- **Push Notifications**: Expo Notification Service for mobile; Web Push API (service worker + browser permission) for the web portal. Device token registration must distinguish token type so the Edge Function dispatches to the correct service.
- **State Management**: React Query for server state, React Context for auth/duty state (both frontends).

### Schema Overview
- `care_recipients` — root tenant
- `user_roles` — role per user per care recipient
- `duty_sessions` — check-in/check-out per carer
- `scheduled_items` — all recurring tasks; feeding items include `bolus_rest_minutes`
- `feeding_sessions` — guided feeding records, including `bolus_rounds_completed`
- `event_log` — append-only audit log
- `as_needed_medications` — definitions for PRN medications
- `push_tokens` — device tokens per user

---

## Testing Decisions

Good tests verify external behaviour, not implementation details. A test should break only when the observable outcome changes — not when internal logic is refactored. Tests should use real Supabase schema via a local Supabase instance or test database, not mocks of the database layer.

### Modules to Test

**Schedule Engine**
- Verify that a scheduled item generates the correct due time given a base time and recurrence rule.
- Verify overdue and missed threshold logic: an item is overdue after `overdue_window_minutes`, missed after `missed_threshold_minutes`, and neither if completed within the window.
- Verify that supplement medications are flagged differently from compulsory ones in the overdue/missed logic.
- Verify that a feeding schedule item exposes its `bolus_rest_minutes` value correctly to the session runner.

**Session Runner**
- Verify that a feeding session records correct `started_at` and `completed_at` on completion.
- Verify that `bolus_rounds_completed` equals the number of rounds marked done before ending the session.
- Verify that an abandoned session records `bolus_rounds_completed` as the partial count actually given, not zero.
- Verify that skipping the rest period does not alter the bolus round count.
- Verify that an abandoned session does not block the next scheduled feeding.
- Verify that the countdown timer duration matches the `bolus_rest_minutes` configured on the schedule item.

**Event Log**
- Verify that completing a scheduled item writes exactly one event log entry with correct fields.
- Verify that logging an as-needed medication writes an entry with `event_type = as_needed_medication`.
- Verify that the log is immutable — no update or delete operations succeed.
- Verify that event log entries are scoped to the correct care recipient and not visible to other tenants.

**Bulk Catch-Up**
- Verify that triggering a bulk catch-up writes exactly one event log entry per overdue scheduled event (excluding feeding sessions).
- Verify that each bulk-confirmed entry has `occurred_at` equal to the scheduled time of the event, not the time the bulk action was performed.
- Verify that each bulk-confirmed entry carries `bulk_confirmed = true` and is attributed to the carer who initiated the action.
- Verify that events already marked missed are not included in the bulk catch-up scope.
- Verify that overdue feeding sessions are included in bulk catch-up and produce a `feeding_sessions` record with `bulk_confirmed = true` and `bolus_rounds_completed = null`.
- Verify that after a bulk catch-up, the timeline shows all affected items — including feeding sessions — as completed.

**Carer Duty**
- Verify that a carer who has checked in but not checked out is considered on-duty.
- Verify that a carer who has checked out is not on-duty.
- Verify that an admin is always considered on-duty regardless of duty session state.
- Verify that multiple carers can be on-duty simultaneously.
- Verify that notifications are dispatched only to on-duty carers.
- Verify that an admin can open or close a duty session on behalf of another carer.

---

## Out of Scope

- Native mobile push from the web portal (web portal uses Web Push API only, not Expo)
- Mobile-specific form factors (the web portal is desktop-first; it is not required to work well on a mobile browser)
- Offline mode / local-first sync
- Export of care records (PDF, CSV)
- SMS or email escalation for unacknowledged notifications
- Multiple care recipients per family (schema supports it, UI does not)
- Day-of-week medication schedules (daily recurrence only)
- Individual bolus-level recording within a feeding session (volume per round, etc.)
- Integration with external nursing or medical record systems
- Billing, subscription management, or user self-registration (invite-only only)

---

## Further Notes

- Both the mobile app and the web portal are first-class platforms. Any feature built for one must be considered for the other. Architecture and data model decisions must not bake in mobile-only assumptions.
- The web portal is a separate React (TypeScript) codebase — not Expo Web. Shared logic (validation, schedule calculations, types) should be extracted into a shared package if practical.
- The app is designed for a single child initially but architected for multi-tenancy from day one, so other families can use it later.
- Row-level security in Supabase is the primary data isolation mechanism — this must be thoroughly reviewed before any public release.
- The missed-event background job (Edge Function) is a critical piece of infrastructure; if it fails silently, the audit log will be incomplete.
- The number of daily feeding sessions is determined entirely by the schedule (e.g. 3 or 4 per day) and is not hardcoded in the app. The admin configures this via scheduled feeding items.
- The bolus rest timer defaults should reflect the current clinical protocol (typically 20 or 25 minutes). Admins can change this per feeding item without a code change.
