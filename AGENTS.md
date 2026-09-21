# FinTrack Backend - Agent Guidelines & Rules

Welcome! This document defines development standards, architecture rules, and conventions for AI coding assistants (including **Google Antigravity**, **OpenCode**, and other autonomous agents) operating on this repository.

---

## 1. Project Overview & Tech Stack

- **Project Name:** FinTrack Backend (`fintrack-be`)
- **Runtime:** [Bun](https://bun.sh/) (version 1.1+)
- **Framework:** [ElysiaJS](https://elysiajs.com/)
- **Documentation:** `@elysiajs/swagger` (Interactive OpenAPI at `/swagger`)
- **Primary Feature:** AI-powered receipt scanning & data extraction forwarder

---

## 2. Directory Structure & Architecture Standards

All code must adhere to ElysiaJS modular feature architecture:

```text
src/
├── config/
│   └── env.ts                 # Strongly typed environment configuration
├── constants/
│   └── prompts.ts             # AI system instructions and JSON schemas
├── db/
│   ├── schema/
│   │   ├── email-verification-tokens.ts # Email verification tokens schema & types
│   │   ├── index.ts           # Schema re-exports
│   │   ├── invite-codes.ts    # Invite codes table schema & types
│   │   ├── receipts.ts        # Receipts table schema & types
│   │   ├── refresh-tokens.ts  # Refresh tokens table schema & types
│   │   └── users.ts           # Users table schema & types
│   └── index.ts               # Drizzle ORM & Postgres client connection
├── modules/
│   ├── auth/                  # Authentication & authorization module
│   │   ├── auth.model.ts      # TypeBox schemas (Register, Login, User)
│   │   ├── auth.service.ts    # Auth business logic (hashing, verification)
│   │   └── auth.controller.ts # Elysia auth routes & authPlugin guard (/auth)
│   └── receipt/               # Receipt extraction domain module
│       ├── receipt.model.ts   # TypeBox schemas (Request, Response, Entities)
│       ├── receipt.service.ts # Business logic & upstream integrations
│       └── receipt.controller.ts # Elysia route plugin with prefix (/receipts)
├── scripts/
│   ├── db-reset.ts            # Database reset utility (drops all tables)
│   └── db-seed.ts             # Database seeding utility (placeholder)
├── utils/
│   ├── email.ts               # Transactional email utility (Brevo REST API)
│   ├── image.ts               # Image & media utilities (Data URL conversion)
│   ├── logger.ts              # Custom pretty rotating file logger
│   └── rate-limiter.ts        # Native sliding-window rate limiter utility
└── index.ts                   # App composition root (plugins, hooks, global errors)
```

### Architecture Invariants & Structure Rules
1. **Mandatory Auto-Update Rule for AGENTS.md:**
   - Whenever an agent creates, removes, moves, or renames any files or directories (such as adding a new module under `src/modules/`, new utilities, or new config files), the agent **MUST automatically update Section 2 of `AGENTS.md`** to reflect the exact current file tree before finishing the task.
   - The tree in `AGENTS.md` must never be allowed to go stale.
2. **Separation of Concerns:**
   - **Controllers** handle HTTP parameters, query, body, headers, and status codes.
   - **Services** encapsulate business logic, external API calls, and data transformations.
   - **Models** define TypeBox schemas for compile-time and runtime validation.
3. **Feature Encapsulation:**
   - New features belong in `src/modules/<feature_name>/`.
   - Each controller exports an `Elysia` instance with a route prefix (e.g., `new Elysia({ prefix: "/receipts" })`).
   - Register new controllers in `src/index.ts` using `.use(featureController)`.
   - Detailed runbook available in [`.agents/skills/create-elysia-route/SKILL.md`](./.agents/skills/create-elysia-route/SKILL.md).

---

## 3. Upstream AI Router Rules

When communicating with the upstream AI completion endpoint:
1. **Endpoint Resolution:** Always read `routerEndpoint` from `src/config/env.ts` (mapped to `process.env.ROUTER_ENDPOINT`). Never hardcode router URLs.
2. **Authentication:**
   - Always supply **both** `Authorization: Bearer <key>` and `x-api-key: <key>` headers to ensure full router compatibility.
   - Strip any accidental duplicate `Bearer ` prefix before setting headers.
3. **Receipt Output Format:**
   - Keep the upstream AI response strictly in JSON format matching `src/constants/prompts.ts`.
   - Strip markdown code fences if present when parsing JSON.
4. **No Leaking Raw Payloads to HTTP Responses:**
   - Return only `{ success: true, data: <parsed_receipt> }` to HTTP clients.
   - The full raw completion JSON must be saved into rotating log files via `logger.raw(...)`.

---

## 4. Logging Standards

**DO NOT use raw `console.log` or `console.error` in application code.** Always use `logger` from `src/utils/logger.ts`.

- `logger.info(message, ...meta)`: General lifecycle events.
- `logger.success(message, ...meta)`: Successful operation completions.
- `logger.warn(message, ...meta)`: Recoverable issues, validation rejections.
- `logger.error(message, ...meta)`: Unhandled exceptions or upstream failures.
- `logger.raw(title, rawPayload)`: Complete AI completion payloads (persists exclusively to rotating log `logs/raw-YYYY-MM-DD.log` while showing a clean summary in the console).

### Log Rotation Rules
- There are strictly **two rotating log files** in `logs/`:
  - `system-YYYY-MM-DD.log`: For all system, application lifecycle, error, warning, and info logs.
  - `raw-YYYY-MM-DD.log`: Exclusively for raw upstream AI responses and completions (never mixed into system logs).
- Never commit `logs/` or `*.log` files to version control.

---

## 5. Environment & Security Rules

1. **Environment Variables:**
   - Never commit `.env` or files containing production API keys.
   - When introducing new environment variables:
     - Add them to `src/config/env.ts` with sensible defaults.
     - Document placeholders in `.env.example` (using generic example URLs, never private domains).
2. **Allowed Ports:**
   - Default port is `3000` or `process.env.PORT`.

---

## 6. Error Handling & Validation Rules

1. **Uniform Response Structure:**
   - Success: `{ "success": true, "data": <payload> }`
   - Error: `{ "success": false, "error": "<Human readable error message>", "details": [ ... ] }`
2. **Clean Validation Errors:**
   - Do NOT dump raw TypeBox internal ASTs (`type: 45`, `schema: ...`, `errors: []`).
   - Extract simplified `{ field, message }` objects so frontend clients receive clean, actionable feedback.
3. **HTTP Status Codes:**
   - `400`: Validation error or malformed input.
   - `401`: Missing or invalid API key.
   - `404`: Route not found.
   - `500`: Server or upstream provider failure.

---

## 7. Development & Verification Commands

- **Start Dev Server (Hot-reload):** `bun run dev`
- **TypeScript Typecheck:** `bun run typecheck`
- **Build & Bundle Validation:** `bun build --target=bun src/index.ts --no-bundle`
- **Install Dependencies:** `bun install` / `bun add <pkg>`
- **Swagger Documentation:** Visit `http://localhost:3000/swagger` in the browser
