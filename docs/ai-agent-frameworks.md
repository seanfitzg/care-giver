# AI Agent Frameworks

## What Mastra Is

[Mastra](https://mastra.ai) is an open-source TypeScript framework for building AI agents. The key things it gives you on top of the raw Anthropic SDK:

| Feature              | Plain SDK            | Mastra                              |
| -------------------- | -------------------- | ----------------------------------- |
| Tool calling         | You wire it manually | Typed tool definitions, auto-called |
| Multi-step workflows | You write the loop   | Declarative workflow graph          |
| Agent memory         | You build it         | Built-in (thread-based)             |
| Observability        | Nothing              | Traces, step logs built in          |

---

## The Compatibility Issue

Supabase Edge Functions run on **Deno**, and Mastra targets **Node.js**. They are not directly compatible. Two options:

**Option A — Keep agents in Edge Functions** using the plain Anthropic SDK (simpler, fewer moving parts, recommended to start)

**Option B — Add a small Mastra service** (Node.js, deployed to Railway or Fly.io) that Edge Functions call via HTTP webhook for complex agents

---

## Which Agents Suit Which Approach

**Plain Anthropic SDK in an Edge Function (start here):**

- **Shift Handover Summary** — clear trigger, fixed tools, single response.
- **Natural Language Log Entry** — structured extraction, no looping needed.

**Good Mastra candidates (once comfortable with the basics):**

- **Anomaly Detection Agent** — Mastra's workflows are ideal. Define a graph: `fetch_recent_events → analyze_pattern → [branch: alert | no_action]`. Branching, retry logic, and step traces come for free.
- **Care Report Agent** — Benefits from Mastra's memory (so the admin can follow up: "now add last Tuesday") and multi-tool planning.

---

## A Concrete Mastra Example

The Anomaly Detection Agent as a Mastra workflow:

```typescript
// called from an Edge Function or cron trigger
const anomalyWorkflow = new Workflow({ name: 'anomaly-detection' })
  .step(fetchRecentEvents) // tool: query event_log
  .step(compareToSchedule) // tool: query scheduled_items
  .step(classifyAnomalies) // LLM step: is this worth flagging?
  .branch([
    { condition: hasAnomalies, step: createAlert },
    { condition: noAnomalies, step: logClean },
  ]);
```

The LLM is only involved in the `classifyAnomalies` step — data fetching is deterministic. That is the core idea of agentic workflows: AI decides, tools act.

---

## Recommended Learning Path

1. Build the **Shift Handover Summary** using the plain Anthropic SDK in a Supabase Edge Function. This teaches tool calling and agent loops with minimal infrastructure. Use the `/claude-api` skill to scaffold it.
2. Explore **Mastra** after that for agents that need multi-step workflows with branching or memory across conversations. The Anomaly Detection Agent is the right target.
