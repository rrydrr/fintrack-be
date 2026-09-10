# Elysia Architecture Rules

This rule enforces coding and structure conventions for the ElysiaJS backend.

## Framework Conventions
- **Runtime:** Bun (`bun run dev`). Avoid Node.js-specific CLI tools when Bun equivalents exist.
- **Module Pattern:** All business features must reside in `src/modules/<feature_name>/` containing:
  - `<feature>.model.ts`: TypeBox schemas for body, query, and responses.
  - `<feature>.service.ts`: Business logic and external API integrations.
  - `<feature>.controller.ts`: Elysia controller with route prefix (e.g. `new Elysia({ prefix: '/...' })`).
- **Composition Root:** New controllers must be registered in `src/index.ts` using `.use(controller)`.
- **API Documentation:** Every endpoint must include OpenAPI `detail` metadata (`summary`, `tags`) so Swagger at `/swagger` remains up to date.
- **Response Format:**
  - Success: `{ success: true, data: ... }`
  - Error: `{ success: false, error: string, details?: Array<{ field: string, message: string }> }`

## Verification Rule
- After any code modification, always verify types and runtime build:
  1. `bun run typecheck`
  2. `bun build --target=bun src/index.ts --no-bundle`
