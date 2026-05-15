# care-giver

Multi-tenant care coordination app for people with complex medical needs, used by families and carers to track medications, nutrition, and therapy activities across a shared care team.

## Language

### People & Roles

**Care Recipient**:
The person receiving care (e.g. a child or adult with complex needs). The root tenant — all data is scoped to them.
_Avoid_: Patient, client, user

**Admin**:
A user with full control over a care recipient's schedule, team, and settings. Typically the parent or primary carer.
_Avoid_: Owner, parent

**Senior Carer**:
A user who can manage the schedule and invite others, but cannot change team roles.
_Avoid_: Lead carer, supervisor

**Carer**:
A user who records care events but cannot change the schedule or team.
_Avoid_: Staff, worker, helper

### Care Events

**Nutrition Session**:
A guided or recorded event in which the care recipient receives food or formula — either by bolus tube feed, or oral feeding (self-directed or carer-assisted).
_Avoid_: Feeding session, feed

**Bolus**:
A single unit of tube-fed formula delivered during a nutrition session, followed by a configurable rest period.
_Avoid_: Round, dose (in nutrition context)

**Medication**:
A scheduled or as-needed drug administered to the care recipient.

**PRN Medication** (also: as-needed medication):
A medication that is not scheduled but can be logged at any time.
_Avoid_: Unscheduled medication, ad-hoc medication

**Compulsory Medication**:
A scheduled medication where a missed dose is clinically significant. Displayed with a "Compulsory" badge in the timeline.
_Avoid_: Required medication, critical medication

**Supplement**:
A scheduled medication that is non-compulsory — a missed dose is less critical. The absence of the "Compulsory" badge indicates a supplement.
_Avoid_: Optional medication, non-critical medication

**Activity**:
A scheduled therapy or physical task (e.g. stander time).
_Avoid_: Task, exercise

**Bulk Catch-Up**:
A single action that marks all currently overdue events as completed, with a shared note and a single attributed carer.
_Avoid_: Batch confirm, mass confirm

### Schedule

**Scheduled Item**:
A recurring task on the care recipient's schedule — either a medication, a nutrition session, or an activity. All types are scheduled by a fixed `time_of_day`. Currently all items recur daily; day-of-week recurrence is planned but not yet implemented.
_Avoid_: Task, event (in schedule context)

**Overdue Window**:
The number of minutes after a scheduled item's due time during which it can still be completed. Once elapsed without completion, the item becomes missed. The single timing concept — there is no separate missed threshold.
_Avoid_: Grace period, tolerance, missed threshold

**Missed**:
A scheduled item whose overdue window elapsed without being completed or skipped.
_Avoid_: Skipped, unfulfilled

### Nutrition Detail

**Nutrition Type**:
The delivery method for a nutrition session — one of exactly three values: `bolus` (tube feed; launches the guided session runner with a rest-period countdown), `oral_self` (care recipient feeds themselves; simple direct-record flow), or `oral_carer` (carer assists with oral feeding; simple direct-record flow).

**Bolus Rest**:
The configurable rest period between bolus rounds during a bolus nutrition session.
_Avoid_: Rest period, pause

### Event Log

**Event Log**:
The append-only audit record of all care events. Never updated or deleted.

**Bulk-Confirmed**:
An event log entry (or nutrition session) created via a bulk catch-up rather than recorded individually at the time. Bulk-confirmed nutrition sessions have `all_consumed = null` — the value is unknown, not false.

## Relationships

- A **Care Recipient** has one or more **Scheduled Items**
- A **Scheduled Item** of type `nutrition` produces a **Nutrition Session** when completed
- A **Scheduled Item** of any type produces an **Event Log** entry when completed, missed, or skipped
- A **Bulk Catch-Up** produces one **Event Log** entry per overdue **Scheduled Item**, all marked bulk-confirmed
- A **PRN Medication** produces an **Event Log** entry each time it is administered

## Example dialogue

> **Dev:** "When a bolus **Nutrition Session** is abandoned, does it count as a missed event?"
> **Domain expert:** "No — the session is recorded as incomplete with `all_consumed = false`. A **missed** event only happens when no session was started at all and the **Overdue Window** elapsed."

> **Dev:** "Should a **Supplement** medication appear in the overdue banner?"
> **Domain expert:** "Yes, but with amber styling, not red. It still needs to be done — it's just lower priority than a **Compulsory Medication**."

## Flagged ambiguities

- "feeding" was used throughout the original PRD and early migrations — resolved: **Nutrition** is the canonical term for all food/formula delivery.
