---
name: create-elysia-route
description: >-
  Use this skill when adding, scaffolding, or implementing new routes, endpoints,
  or feature modules in the FinTrack ElysiaJS backend.
---

# Create Elysia Route Workflow

This skill outlines the standard, domain-driven procedure for scaffolding and implementing new routes in `fintrack-be`.

---

## 1. Module Structure Standard

Every new feature or route collection must be placed in its own domain module under `src/modules/<feature-name>/`:

```text
src/modules/<feature-name>/
├── <feature-name>.model.ts       # TypeBox schemas (Request, Response, Entities)
├── <feature-name>.service.ts     # Business logic & upstream integrations
└── <feature-name>.controller.ts  # Elysia router plugin with route prefix
```

---

## 2. Step-by-Step Implementation

### Step 1: Create the Model (`<feature-name>.model.ts`)
Define request and response schemas using TypeBox (`t` from `elysia`):

```typescript
import { t } from "elysia";

export const CreateExampleBodyModel = t.Object({
  name: t.String({ description: "Name of the entity" }),
  amount: t.Number({ description: "Monetary amount" }),
});

export const ExampleResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Any()),
  error: t.Optional(t.String()),
});
```

### Step 2: Create the Service (`<feature-name>.service.ts`)
Encapsulate business logic, database transactions, or external integrations:

```typescript
import { logger } from "../../utils/logger";

export class ExampleService {
  public async handleAction(payload: { name: string; amount: number }) {
    logger.info("Executing example action", payload);

    // Business logic goes here
    const result = { id: crypto.randomUUID(), ...payload };

    logger.success("Example action completed", { id: result.id });
    return result;
  }
}

export const exampleService = new ExampleService();
```

### Step 3: Create the Controller (`<feature-name>.controller.ts`)
Define the Elysia route plugin with prefix, input validation, and Swagger metadata:

```typescript
import { Elysia } from "elysia";
import { CreateExampleBodyModel } from "./example.model";
import { exampleService } from "./example.service";

export const exampleController = new Elysia({ prefix: "/examples" })
  .get(
    "/",
    async () => {
      return { success: true, data: [] };
    },
    {
      detail: {
        summary: "List all example items",
        tags: ["Examples"],
      },
    }
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const data = await exampleService.handleAction(body);
        set.status = 201;
        return { success: true, data };
      } catch (err: any) {
        set.status = err.status || 500;
        return {
          success: false,
          error: err.message || "Failed to process request",
        };
      }
    },
    {
      body: CreateExampleBodyModel,
      detail: {
        summary: "Create a new example item",
        tags: ["Examples"],
      },
    }
  );
```

### Step 4: Register Controller in `src/index.ts`
Import the new controller and register it with `.use(...)`:

```typescript
import { exampleController } from "./modules/example/example.controller";

export const app = new Elysia()
  // ... middlewares
  .use(receiptController)
  .use(exampleController) // <-- Register new module here
  .listen(config.port);
```

### Step 5: Auto-Update `AGENTS.md` Directory Tree
Immediately update Section 2 of [`AGENTS.md`](../../AGENTS.md) to add the newly created module (e.g. `src/modules/<feature-name>/`) to the directory structure diagram.

---

## 3. Verification Steps

1. **TypeScript Typecheck:**
   ```bash
   bun run typecheck
   ```

2. **Build & Bundle Validation:**
   ```bash
   bun build --target=bun src/index.ts --no-bundle
   ```

3. **Test Route Execution:**
   Run an in-memory test using `app.handle`:
   ```bash
   bun -e "import { app } from './src/index'; const res = await app.handle(new Request('http://localhost:3000/<feature>')); console.log(res.status, await res.json()); process.exit(0);"
   ```

4. **Check OpenAPI Documentation:**
   Confirm that the new endpoint appears in Swagger UI at `http://localhost:3000/swagger`.
