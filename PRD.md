# PRD: care-giver — Care Coordination App

## Problem Statement

Families and carers supporting a person who requires full-time care — whether a child, an adult with serious disabilities, or an elderly person — must coordinate medication schedules, nutrition sessions, therapy activities, and other routines across multiple caregivers throughout the day. There is no shared, real-time record of what has been done, what is overdue, and who is currently responsible. Missed medications, incorrect nutrition schedules, or lack of visibility into care history create serious risk for the care recipient and stress for those responsible for their care.

The domain model and architectural decisions are documented in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr/`](./docs/adr/).

## User Stories

### Authentication & Onboarding

1. As an admin, I want to create a care recipient profile, so that all schedules and logs are scoped to the person in my care.
2. As an admin, I want to invite carers by email, so that they can access the app without me sharing credentials.
3. As an admin, I want to assign a role (Senior Carer or Carer) when inviting someone, so that access levels are set from the start.
4. As an invited carer, I want to receive an email with a secure setup link, so that I can create my account and access the app.
5. As an admin, I want to revoke a carer's access, so that former carers can no longer view or record care events.
6. As any user, I want to log in securely with my email and password, so that care records are protected.

### Schedule Management

13. As an admin or senior carer, I want to create a scheduled medication with a fixed daily time, so that carers are reminded to administer it.
14. As an admin or senior carer, I want to flag a medication as a supplement (non-compulsory), so that a missed dose is treated less critically than a compulsory medication.
15. As an admin or senior carer, I want to set a per-item overdue window, so that the system accounts for tasks with different time tolerances.
16. As an admin or senior carer, I want to create a nutrition session schedule with a fixed daily time and nutrition type, so that carers are guided through the correct feeding protocol.
17. As an admin or senior carer, I want to set the bolus rest duration (e.g. 20 or 25 minutes) per bolus nutrition schedule, so that the countdown timer matches the protocol prescribed for this care recipient.
18. As an admin or senior carer, I want to configure a generic scheduled activity (e.g. stander time) with a time and duration, so that therapy tasks are also tracked.
19. As an admin or senior carer, I want to edit or delete any scheduled item, so that the schedule stays accurate as care needs change.

### Nutrition Session

22. As a carer, I want to start a guided bolus nutrition session, so that I am walked through each bolus and rest period.
23. As a carer, I want to see a countdown timer for the configured rest period between bolus rounds, so that I know when to resume feeding.
24. As a carer, I want the rest duration to reflect the value set in the nutrition schedule, so that I follow the correct protocol without having to remember it.
25. As a carer, I want to skip the rest period early if the care recipient is ready, so that I am not forced to wait for the timer when it is clinically appropriate to proceed.
26. As a carer, I want to record the start time of a nutrition session automatically, so that I do not need to enter it manually.
27. As a carer, I want to see an elapsed-time counter during an active session, so that I can track how long the overall session is taking.
28. As a carer, I want to record the end time of a nutrition session when I mark it complete, so that the full duration is captured.
29. As a carer, I want to mark whether all nutrition was consumed at the end of a session, so that the log reflects whether the session was fully completed.
30. As a carer, I want to add a note to a nutrition session, so that I can record if a session was incomplete or the care recipient showed discomfort.
31. As a carer, I want the nutrition session log to record which carer administered it, so that there is an accurate audit trail.
32. As a carer, I want to abandon a nutrition session with a confirmation step, so that an incomplete session is recorded and I am not returned to the timeline by accident.

### Medication Recording

34. As a carer, I want to mark a scheduled medication as given, so that other carers know it has been administered.
35. As a carer, I want to record an as-needed medication at any time, so that ad-hoc doses are always captured.
36. As a carer, I want to add a note when recording any medication, so that I can capture context (e.g. refused, partial dose).
37. As any user, I want to see which carer recorded each medication event, so that accountability is clear.

### Activity Recording

38. As a carer, I want to mark a scheduled activity as complete, so that the log reflects what has been done.
39. As a carer, I want to add a note when completing an activity, so that I can record observations.

### Notifications & Alerts

40. As a carer, I want to receive a push notification when a task is due, so that I am reminded even when the app is in the background. **Planned; not yet built.**
41. As a carer, I want to see a prominent in-app alert for any overdue task, so that nothing is missed when I open the app.
42. As a carer, I want overdue tasks to be visually distinct (e.g. red) in the timeline, so that I can prioritise at a glance.
43. As a carer, I want to see a "missed" label on tasks that passed their overdue window without being completed, so that the record is accurate.
44. As a user, I want to see a clear connectivity warning when the app is offline, so that I know notifications may not be reliable.

### Bulk Catch-Up

45. As a carer, I want to mark all overdue events as complete in one action, so that I can quickly catch up the app record after a period of care without logging.
46. As a carer, I want to add a single note that applies to the entire bulk catch-up, so that I can record context (e.g. "carer was present, app not used") without repeating it for each event.
47. As any user, I want bulk-confirmed events to be visually distinguishable in the history log, so that it is clear they were confirmed together rather than individually at the time.
48. As an admin, I want bulk-confirmed events to be attributed to the carer who performed the catch-up, so that accountability is maintained even when recording was delayed.

### Timeline View

50. As a carer, I want to see a rolling timeline of today's tasks (past and upcoming), so that I have a full picture of the care day.
51. As a carer, I want the timeline window to be configurable (e.g. past 2 hours, next 6 hours), so that it matches my working style. **Planned; not yet implemented.**
52. As any user, I want completed tasks to be visually distinct from pending tasks in the timeline, so that I can see progress at a glance.
53. As any user, I want overdue tasks to appear prominently at the top of the timeline, so that urgent items are never buried.

### History & Log

54. As an admin, I want to view a log of all care events for any date range, so that I can review what happened over time.
55. As any user, I want to filter the log by event type (medication, nutrition, activity, missed), so that I can find specific records quickly.
56. As any user, I want each log entry to show the carer, the time, any notes, and (for nutrition sessions) whether all nutrition was consumed, so that the record is complete.
57. As an admin, I want to see missed events in the log, so that gaps in care are visible.

### Platform & Device Support

58. As a carer, I want to use the app on my iPhone, so that I can act on reminders while moving around the house.
59. As a carer, I want to use the app on my Android phone, so that I am not required to own an Apple device.
60. As an admin, I want to use the app on an iPad, so that I have a larger screen for reviewing the schedule and care history.
61. As an admin, I want to use a dedicated web app on a desktop browser, so that I have a full-featured interface for managing the schedule, reviewing care history, and managing the carer team without needing my phone. **Planned; not yet started.**
62. As a carer, I want to use the web app on any desktop browser, so that I can record care events and check the timeline without installing anything. **Planned; not yet started.**
63. As an on-duty carer using the web app, I want to receive browser push notifications when a task is due, so that I am reminded even when the browser tab is in the background. **Planned; not yet started.**

### Multi-Tenancy

64. As an admin, I want my care recipient's data to be completely isolated from other accounts using the app, so that privacy is maintained.
65. As an admin, I want to set up a care recipient profile with a name and date of birth, so that the app is personalised to the person in my care.

---

## Out of Scope

- Offline mode / local-first sync
- Export of care records (PDF, CSV)
- SMS or email escalation for unacknowledged notifications
- Multiple care recipients per family (schema supports it, UI does not)
- Day-of-week recurrence for scheduled items (planned; all items currently recur daily)
- Individual bolus-level recording within a nutrition session (volume per round, etc.)
- Integration with external nursing or medical record systems
- Billing, subscription management, or user self-registration (invite-only)
- A shared component library between the mobile and web clients (types are copied as needed; a shared package can be introduced later if duplication becomes a maintenance burden)
