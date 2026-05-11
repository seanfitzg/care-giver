# AI Agent Ideas

## What makes something an "agent"?

An agent is an AI that has **tools** it can call to gather information or take actions, and it **decides** which tools to use based on its goal — vs. a plain AI call which is just: prompt in, text out.

---

## Agents that fit this codebase

### 1. Shift Handover Summary Agent _(best starter)_

**What it does:** When a carer checks out, the agent queries the DB for everything that happened during their shift, then writes a natural-language handover note.

**Why it's agentic:** It uses tools — `get_events_since_checkin`, `get_overdue_items`, `get_upcoming_tasks` — and decides what to include based on what it finds. A simple "missed 2 meds, 3 feeds completed, 1 note about discomfort" summary.

**Hosted as:** A Supabase Edge Function triggered by the check-out mutation.

---

### 2. Anomaly Detection Agent _(intermediate)_

**What it does:** Runs on a schedule (e.g. every 30 mins), scans recent events for patterns that warrant attention — e.g. "no feeding session logged in 4 hours", "medication X has been noted 'partial dose' 3 days running".

**Why it's agentic:** Multi-step reasoning — it queries the log, compares against the schedule, decides whether something is unusual enough to flag, then either creates an alert or calls a notification tool.

---

### 3. Care Report Agent _(practical for real use)_

**What it does:** Admin asks in plain English — _"Give me a summary of last week for the GP appointment"_ — and the agent figures out what data to pull, formats it appropriately, and returns a shareable report.

**Why it's agentic:** It has to plan what queries to run before it knows what the report should contain.

---

### 4. Natural Language Log Entry _(simplest to wire up)_

**What it does:** Carer types "gave 3 boluses, she seemed unsettled" and an agent parses it into structured fields — event type, bolus count, note text — before inserting into the DB.

**Why it's agentic (sort of):** This is borderline — it's more like structured extraction. But it's a good first step to understand how AI turns unstructured input into structured actions.

---

## Where to start

The **Shift Handover Summary** is the recommended first agent:

- Clear trigger (check-out event)
- Well-defined tools (DB queries)
- Immediately useful output
- Fits naturally as a Supabase Edge Function calling the Anthropic API

Use the `/claude-api` skill in Claude Code to scaffold it — it knows the Anthropic SDK and will set up prompt caching (important for agents that run frequently).
