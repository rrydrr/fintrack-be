# Logging & Security Rules

This rule enforces logging conventions, data privacy, and secret hygiene.

## Logging Guidelines
- **Zero raw console logs:** Always import and use `logger` from `src/utils/logger.ts`.
- **Log Levels:**
  - `logger.info()`: General server events and operational steps.
  - `logger.success()`: Completed workflows and operations.
  - `logger.warn()`: Validation failures or non-fatal anomalies.
  - `logger.error()`: Upstream failures and unhandled exceptions.
  - `logger.raw()`: Complete upstream AI completions (persisted exclusively to rotating `logs/raw-*.log` files, never added to system logs).
- **Log Files:** Strictly two rotating files: `logs/system-*.log` and `logs/raw-*.log`. Never commit `logs/` to version control.

## Security & Secrets
- Never hardcode API keys, tokens, or private endpoint URLs into source code.
- All secrets must be loaded from `src/config/env.ts` which reads from `.env`.
- Keep `.env.example` generic (never expose private domain URLs or live tokens).
- Always send both `Authorization: Bearer <key>` and `x-api-key: <key>` headers when calling the upstream AI router.
