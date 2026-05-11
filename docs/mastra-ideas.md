# Mastra Integration Ideas

Mastra is a TypeScript AI framework for building agents and workflows — a good fit for this app since it's already TypeScript/Node and uses Supabase.

## Beginner — single agent, minimal wiring

### 1. Shift handover generator

An agent reads the day's event log from Supabase and writes a structured handover note in natural language ("She had 3 bolus feeds, 480ml total. PRN baclofen given at 14:30. One small vomit at 11am..."). Low complexity, immediately useful.

### 2. Care plan Q&A (RAG)

Chunk care plan documents into Supabase with `pgvector`, then let carers ask questions like "what do I do if she pulls at her tube?" and get answers grounded in the actual care plan, not hallucinated.

## Intermediate — multi-step workflows

### 3. Nutrition intake tracker

A workflow that aggregates bolus + oral feed logs daily, compares against prescribed targets, and surfaces a simple "on track / below target" flag with natural language reasoning.

### 4. PRN medication safety check

Before logging a PRN dose, an agent checks the log for recent doses of the same medication and warns if the minimum interval hasn't elapsed or the daily limit is approaching.

## Advanced — pattern detection + proactive alerts

### 5. Symptom pattern detection

A scheduled agent that scans weeks of event history looking for correlations (e.g., seizures clustering after a particular feed type, or vomiting frequency increasing ahead of illness).

### 6. Anomaly reasoning workflow

When an unusual event is logged (seizure outside normal window, O2 dip), a multi-step workflow gathers context, reasons about severity, and drafts a message to the parent/nurse for a carer to review before sending.

## Recommended starting point

The **shift handover generator** (#1) has the best learning ROI — short feedback loop, real daily value, and it teaches Mastra's agent + tool pattern without needing embeddings or complex state.
