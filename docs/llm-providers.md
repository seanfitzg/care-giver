# LLM Providers for care-giver

Use case: low-volume queries (e.g. medical term lookups) from a Supabase Edge Function proxy.

## Recommended approach

Run the LLM behind a **Supabase Edge Function proxy** — the app calls the Edge Function, which calls the LLM provider. Swap the provider via environment variables (`LLM_BASE_URL`, `LLM_API_KEY`) without touching app code.

During local development, point at **LM Studio** (`http://<LAN-IP>:1234/v1`). All providers below use the same OpenAI-compatible API, so the switch is a one-line config change.

## Provider options

| Provider | Free Tier | Notes |
|---|---|---|
| **Cerebras** | Yes | Fast inference, Llama 3 models |
| **OpenRouter** | Some models free | Aggregator — one API key, many models; easy to swap models without code changes |
| **Cloudflare Workers AI** | Yes (Workers free plan) | Good if moving infra toward Cloudflare |
| **Hugging Face Serverless** | Yes (smaller models) | Wide model selection |
| **Together AI** | $1 credit then pay-per-token | Good range of open source models, competitive pricing |

> **Note:** Groq is excluded from consideration.

## Top picks for this project

1. **Cerebras** — simplest free option, fast, good Llama 3 support
2. **OpenRouter** — most flexible; lets you switch models without changing code; has genuinely free models (e.g. Llama 3 via Meta's free allocation)

## Model recommendations

For medical term lookups, **Llama 3** (8B or 70B) and **Mistral** are well-suited. Start with the smaller model and upgrade if quality isn't sufficient.
