# FinTrack Backend (`fintrack-be`)

A modular, high-performance financial tracking and AI-powered receipt data extraction backend built with [ElysiaJS](https://elysiajs.com/), [Bun](https://bun.sh/), and [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL.

---

## 🚀 Key Features

- **⚡ Blazing Fast Runtime**: Powered by Bun 1.1+ and ElysiaJS.
- **🧾 AI Receipt Extraction**: Analyzes receipt images (JPEG, PNG, WebP) and maps them into structured JSON (merchant details, itemized breakdown, taxes, and totals).
- **🗄️ Drizzle ORM & PostgreSQL**: Connected to Neon PostgreSQL with type-safe schema definitions and auto-updating timestamps (`$onUpdate`).
- **📖 Interactive Swagger Documentation**: Explore and test endpoints interactively at `/swagger`.
- **🪵 Pretty Rotating Logger**: High-contrast ANSI console logs with automatic daily and size-based file rotation in `logs/` (retains full raw AI completions for auditing).
- **🛡️ Clean Validation Errors**: Actionable `{ field, message }` error objects instead of raw TypeBox schema AST dumps.
- **🛠️ Database Utilities**: Interactive `db:reset` and `db:seed` CLI scripts with confirmation prompts.

---

## 📁 Project Structure

```text
src/
├── config/
│   └── env.ts                 # Strongly typed environment configuration
├── constants/
│   └── prompts.ts             # AI system instructions and JSON schemas
├── db/
│   ├── schema/
│   │   ├── receipts.ts        # Receipts table schema definition
│   │   └── index.ts           # Drizzle schema barrel export
│   └── index.ts               # Drizzle ORM & Postgres client connection
├── modules/
│   └── receipt/               # Receipt extraction domain module
│       ├── receipt.model.ts      # TypeBox schemas (Request, Response, Entities)
│       ├── receipt.service.ts    # Business logic, AI router, DB persistence
│       └── receipt.controller.ts # Elysia route plugin (/receipts)
├── scripts/
│   ├── db-reset.ts            # Interactive database reset utility (drops tables)
│   └── db-seed.ts             # Interactive database seed utility (placeholder)
├── utils/
│   ├── image.ts               # Image & media utilities (Data URL conversion)
│   └── logger.ts              # Custom pretty rotating file logger
└── index.ts                   # App composition root (plugins, hooks, global errors)
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

```env
PORT=3000
ROUTER_ENDPOINT=https://your-ai-router-endpoint.com/v1/chat/completions
ROUTER_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

---

## 🏁 Getting Started

### 1. Install Dependencies
```bash
bun install
```

### 2. Push Database Schema
```bash
bun run db:push
```

### 3. Run Development Server
```bash
bun run dev
```

The server will be running at:
- **API Base:** `http://localhost:3000`
- **Swagger Docs:** `http://localhost:3000/swagger`

---

## 📡 API Endpoints

### 1. Extract Receipt Data
- **Endpoint:** `POST /receipts/extract`
- **Accepts:**
  - `multipart/form-data`: `image` (file upload)
  - `application/json`: `image` (base64 data URL or raw base64 string)
- **Optional:** `apiKey` override (uses `ROUTER_API_KEY` from `.env` by default)

**cURL Example (File Upload):**
```bash
curl -X POST http://localhost:3000/receipts/extract \
  -F "image=@/path/to/receipt.jpg"
```

**cURL Example (Base64 JSON):**
```bash
curl -X POST http://localhost:3000/receipts/extract \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": "af820df7-a254-4fa3-9136-29b08b7b2ed0",
    "merchant": {
      "name": "RUMAH SAKIT UMUM DAERAH",
      "address": "Jl. Trans Kalimantan Km. 04 Kab. Lamandau, Nanga Bulik 57126",
      "phone": null
    },
    "transaction": {
      "date": "2014-11-12",
      "time": null,
      "invoice_number": "1411.1001",
      "payment_method": null,
      "currency": "IDR"
    },
    "items": [
      {
        "description": "Alkohol 70 % 300 ml",
        "quantity": 1,
        "unit_price": 13000,
        "total_price": 13000
      }
    ],
    "financials": {
      "subtotal": 85000,
      "tax": 0,
      "service_charge": 0,
      "discount": 0,
      "total": 85000
    }
  }
}
```

### 2. List Saved Receipts
- **Endpoint:** `GET /receipts`
- **Description:** Returns all parsed receipts and their full raw AI responses stored in PostgreSQL.

---

## 🛠️ CLI Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Start development server with hot-reload (`--watch`) |
| `bun run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `bun run db:push` | Sync Drizzle schema changes directly to PostgreSQL |
| `bun run db:generate` | Generate SQL migration files |
| `bun run db:migrate` | Apply generated SQL migrations |
| `bun run db:studio` | Launch Drizzle Studio web GUI |
| `bun run db:reset` | Interactive prompt to DROP all database tables |
| `bun run db:seed` | Interactive prompt to run database seed logic |

> **Tip:** You can pass `-y` to `db:reset` and `db:seed` (e.g. `bun run db:reset -- -y`) to bypass confirmation prompts in automated scripts.

---

## 🪵 Logging & Auditing

Logs are automatically organized into two rotating log files under `logs/` (ignored by git):
- `logs/system-YYYY-MM-DD.log`: All server events, lifecycle logs, warnings, and errors.
- `logs/raw-YYYY-MM-DD.log`: Exclusively contains full raw JSON completions from the AI router.

---

## 🤖 Agent Guidelines

Guidelines and rules for AI coding assistants (such as **Google Antigravity** and **OpenCode**) are maintained in [`AGENTS.md`](./AGENTS.md) and [`.agents/rules/`](./.agents/rules/).