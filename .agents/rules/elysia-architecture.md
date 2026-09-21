# Elysia Architecture & Development Best Practices

This rule enforces coding and structure conventions for the ElysiaJS backend, based on official ElysiaJS development best practices and design patterns.

## 1. Modular & Feature-First Architecture
- **Runtime:** Bun (`bun run dev`).
- **Feature Encapsulation:** All business features must reside in `src/modules/<feature_name>/` containing:
  - `<feature>.model.ts`: TypeBox schemas (`t` from `elysia`) for body, query, params, and responses. Single source of truth for runtime validation and compile-time types.
  - `<feature>.service.ts`: Decoupled business logic, database transactions, and calculations. Services must NEVER accept raw Elysia `Context` or `Request`/`Response` objects; they must take typed arguments and return typed data.
  - `<feature>.controller.ts`: Elysia controller instance with prefix (e.g. `new Elysia({ name: '<feature>', prefix: '/<feature>' })`). Responsible only for HTTP parameters, status codes, and delegating to services.
- **Composition Root:** New controllers must be registered in `src/index.ts` using `.use(controller)`.

## 2. Context Extension & Plugin Patterns
- **Method Chaining:** ALWAYS use method chaining on Elysia instances. Elysia's type inference system tracks state, models, and context through the chain. Breaking the chain breaks type inference.
- **Plugin Naming:** Always provide a unique `name` option when instantiating plugins (e.g., `new Elysia({ name: 'feature-name' })`) to ensure proper plugin deduplication.
- **Decorate vs. Derive vs. Resolve:**
  - `.decorate()`: Use strictly for stateless, shared singletons (e.g. database client, logger). Avoid over-decorating.
  - `.derive()`: Use for deriving request-scoped state before validation (e.g., parsing authorization headers).
  - `.resolve()`: Use for request-scoped state that requires validated data (runs after validation).
- **Macros for Cross-Cutting Concerns:**
  - Use `.macro({ ... })` for declarative, reusable route guards (e.g., `roles: ['admin']`, `auth: true`) rather than ad-hoc inline middleware.

## 3. Type Safety & Eden Treaty Compatibility
- **Single Source of Truth:** Define schemas using `t` from `elysia`. Derive TypeScript types with `typeof Schema.static` to eliminate duplicate interface definitions.
- **Explicit Response Schemas:** Always define `response` schemas in route options. This enables Eden Treaty end-to-end type inference and ensures accurate Swagger documentation.
- **Standardized API Envelope:**
  - Success: `{ success: true, data: T, pagination?: PaginationMeta }`
  - Error: `{ success: false, error: string, details?: Array<{ field: string, message: string }> }`
- **Clean Validation Errors:** Never expose raw TypeBox internal AST errors (`type: 45`, `errors: []`). Translate them into human-readable `{ field, message }` objects.

## 4. API Documentation
- Every endpoint must define OpenAPI `detail` metadata:
  - `summary`: Clear, human-readable description of what the endpoint does.
  - `tags`: Grouping tag (e.g. `['Currencies']`, `['Account Types']`, `['Accounts']`).
  - `security`: Include `[{ cookieAuth: [] }]` when protected by authentication cookies.

## 5. Verification Rule
- After any code modification, always verify types and runtime build:
  1. `bun run typecheck`
  2. `bun build --target=bun src/index.ts --no-bundle`
