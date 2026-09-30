# FinTrack Backend

<div align="center">

**Modular, high-performance financial tracking and AI-powered receipt data extraction backend.**

[![ElysiaJS](https://img.shields.io/badge/ElysiaJS-1.2-f97316?style=flat&logo=elysia)](https://elysiajs.com/)
[![Bun](https://img.shields.io/badge/Bun-1.1+-fbf0df?style=flat&logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-c5f74f?style=flat&logo=drizzle)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169e1?style=flat&logo=postgresql)](https://neon.tech/)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI_3.0-85ea2d?style=flat&logo=swagger)](http://localhost:3000/swagger)
[![Frontend Repository](https://img.shields.io/badge/Frontend-fintrack-black?style=flat&logo=github)](https://github.com/rrydrr/fintrack)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-blue)](./LICENSE)

[Overview](#-overview) •
[Features](#-key-features) •
[Tech Stack](#-tech-stack) •
[Architecture](#-project-structure) •
[Getting Started](#-getting-started) •
[Environment Variables](#-environment-variables) •
[API & Endpoints](#-api-endpoints) •
[Available Scripts](#-available-scripts) •
[Frontend Client](#-frontend-client-integration-eden-treaty) •
[Logging](#-logging--auditing) •
[License](#-license) •
[Frontend Repo ↗](https://github.com/rrydrr/fintrack)

</div>

---

## 🌟 Overview

**FinTrack Backend (`fintrack-be`)** is a modular, high-speed REST API server designed for personal wealth management, financial asset & liability tracking, multi-currency conversions, and AI-driven receipt data extraction. 

Engineered with [**ElysiaJS**](https://elysiajs.com/) and [**Bun**](https://bun.sh/), it provides instant startup, ultra-low latency, and native TypeScript inference. It pairs seamlessly with the [**FinTrack Frontend (`fintrack`)**](https://github.com/rrydrr/fintrack) using **Eden Treaty**, unlocking true end-to-end type safety across backend routes and client components with zero code generation.

---

## 🚀 Key Features

- **Financial Accounts & Net Worth Tracking**:
  - Real-time Net Worth calculation with multi-currency conversions.
  - Multi-tier accounts catalog (cash, bank accounts, investments, credit cards, loans).
  - Categorization of assets vs. liabilities with account balance aggregations.
- **AI-Powered Receipt Scanning & Extraction**:
  - Upload receipt images (JPEG, PNG, WebP) or base64 data to extract structured JSON.
  - Automatically identifies merchant details, invoice date/number, line items, taxes, service charges, discounts, and totals.
  - Full raw upstream AI completion audit trail saved to dedicated rotating logs.
- **End-to-End Type Safety (Eden Treaty)**:
  - Direct type inference from Elysia route definitions via `@elysiajs/eden`.
  - Zero manual API typing or code-generation steps required for the companion frontend [fintrack](https://github.com/rrydrr/fintrack).
- **Enterprise-Grade Authentication & Security**:
  - Dual-token session management (`accessToken`, `refreshToken`) stored in secure `HttpOnly` cookies.
  - Refresh token rotation, reuse detection, and global revocation.
  - Email verification workflow powered by Brevo REST API.
  - Role-based authorization (`user` and `admin`) with invite code onboarding.
- **Universal Multi-Currency Engine**:
  - Pre-seeded global currency catalog with base currency conversion rates.
  - Dynamic user-preferred base currency conversions.
- **Interactive Swagger Documentation**:
  - Comprehensive, interactive OpenAPI explorer available out-of-the-box at `/swagger`.
- **Pretty Rotating Logger**:
  - High-contrast ANSI console logs with automatic daily and size-based rotation in `logs/`.
- **Database Seeding & CLI Management**:
  - Drizzle ORM schema migrations and interactive `db:reset` / `db:seed` utilities.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [ElysiaJS](https://elysiajs.com/) (v1.2+) |
| **Runtime & Package Manager** | [Bun](https://bun.sh/) (v1.1+) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) (`drizzle-kit`) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) ([Neon](https://neon.tech/)) |
| **API Documentation** | [Swagger / OpenAPI 3.0](https://swagger.io/) (`@elysiajs/swagger`) |
| **API Client Protocol** | [Eden Treaty](https://elysiajs.com/eden/treaty/overview.html) (`@elysiajs/eden`) |
| **Image Processing** | [Sharp](https://sharp.pixelplumbing.com/) |
| **Transactional Email** | [Brevo REST API](https://www.brevo.com/) |
| **Frontend Web App** | [FinTrack Frontend (`fintrack`)](https://github.com/rrydrr/fintrack) (Next.js 16) |

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
│   │   ├── auth/
│   │   │   ├── email-verification-tokens.ts # Email verification tokens schema & types
│   │   │   ├── index.ts           # Auth schema group re-exports
│   │   │   ├── invite-codes.ts    # Invite codes table schema & types
│   │   │   ├── refresh-tokens.ts  # Refresh tokens table schema & types
│   │   │   └── users.ts           # Users table schema & types
│   │   ├── finance/
│   │   │   ├── account-types.ts   # Account types & master seeder templates schema
│   │   │   ├── accounts.ts        # Financial accounts table schema & types
│   │   │   ├── currencies.ts      # Currencies catalog table schema & types
│   │   │   ├── exchange-rates.ts  # Exchange rates table schema & types
│   │   │   ├── index.ts           # Finance schema group re-exports
│   │   │   └── receipts.ts        # Receipts table schema & types
│   │   ├── index.ts               # Schema root re-exports
│   │   └── schemas.ts             # PostgreSQL auth & finance schemas definition
│   └── index.ts                   # Drizzle ORM & Postgres client connection
├── modules/
│   ├── account/               # Financial accounts & Net Worth module
│   │   ├── account.model.ts   # TypeBox schemas (CRUD, Net Worth summary)
│   │   ├── account.service.ts # Account balance & Net Worth calculation logic
│   │   └── account.controller.ts # Elysia account routes (/accounts)
│   ├── account-type/          # Account types & templates domain module
│   │   ├── account-type.model.ts # TypeBox schemas (CRUD, sync)
│   │   ├── account-type.service.ts # Provisioning, template sync logic
│   │   └── account-type.controller.ts # Elysia account type routes (/account-types)
│   ├── auth/                  # Authentication & authorization module
│   │   ├── controllers/
│   │   │   ├── email.controller.ts       # Email verification endpoints (/verify-email, resend)
│   │   │   ├── invite.controller.ts      # Admin invite code endpoints (/invites)
│   │   │   ├── session.controller.ts     # Auth session endpoints (/register, /login, /refresh, /logout)
│   │   │   └── user.controller.ts        # User profile endpoints (/me, /me/currency)
│   │   ├── services/
│   │   │   ├── email-verification.service.ts # Verification token generation & email dispatch
│   │   │   ├── invite.service.ts         # Invite code creation, listing, & revocation
│   │   │   ├── token.service.ts          # Refresh token rotation, reuse detection, & revocation
│   │   │   └── user.service.ts           # User retrieval & currency preference updates
│   │   ├── auth.controller.ts # Root Elysia auth router composition & guard re-exports (/auth)
│   │   ├── auth.guard.ts      # Rate limiters, JWT plugins, cookie helpers, & authPlugin guards
│   │   ├── auth.model.ts      # TypeBox schemas (Register, Login, User)
│   │   └── auth.service.ts    # Auth orchestrator & subservice delegations
│   ├── currency/              # Universal currencies & exchange rates module
│   │   ├── currency.model.ts  # TypeBox schemas (Currencies, Rates)
│   │   ├── currency.service.ts# Conversion logic & currency CRUD
│   │   └── currency.controller.ts # Elysia currency routes (/currencies)
│   └── receipt/               # Receipt extraction domain module
│       ├── receipt.model.ts   # TypeBox schemas (Request, Response, Entities)
│       ├── receipt.service.ts # Business logic & upstream integrations
│       └── receipt.controller.ts # Elysia route plugin with prefix (/receipts)
├── scripts/
│   ├── db-reset.ts            # Database reset utility (drops across schemas)
│   └── db-seed.ts             # Database seeding utility (currencies, templates, demo accounts)
├── utils/
│   ├── email.ts               # Transactional email utility (Brevo REST API)
│   ├── image.ts               # Image & media utilities (Data URL conversion)
│   ├── logger.ts              # Custom pretty rotating file logger
│   ├── pagination.ts          # Reusable optional pagination models & helper
│   └── rate-limiter.ts        # Native sliding-window rate limiter utility
├── client.ts                  # Eden Treaty client factory & App type export for frontend
└── index.ts                   # App composition root (plugins, hooks, global errors)
```

---

## 🚦 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1 or higher)
- PostgreSQL database instance (such as [Neon](https://neon.tech/))
- Upstream OpenAI-compatible AI Router endpoint (for receipt extraction)
- Brevo API Key (optional, for transactional email verification)

### 1. Clone the repositories

Keep the backend and frontend in sibling directories or configure paths accordingly:

```bash
# Clone backend
git clone https://github.com/rrydrr/fintrack-be.git

# Clone frontend
git clone https://github.com/rrydrr/fintrack.git
cd fintrack-be
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your database and service credentials:

```bash
cp .env.example .env
```

### 4. Push database schema & seed initial data

```bash
# Push table schemas to PostgreSQL
bun run db:push

# Seed default currencies, account templates, and administrative accounts
bun run db:seed
```

### 5. Run the development server

```bash
bun dev
```

Open [http://localhost:3000/swagger](http://localhost:3000/swagger) in your browser to inspect and test all interactive endpoints.

---

## ⚙️ Environment Variables

Create `.env` in the root directory:

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Application environment (`local`, `production`) | `local` |
| `FRONTEND_URL` | Allowed frontend origin for CORS & cookies | `http://localhost:5173` |
| `CORS_ORIGIN` | Allowed comma-separated origins for CORS | `http://localhost:5173,http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string (Neon compatible) | `postgresql://user:password@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | `your-secure-jwt-secret` |
| `JWT_ACCESS_EXP` | Expiration time for access tokens | `15m` |
| `JWT_REFRESH_EXP_DAYS` | Lifetime for refresh tokens in days | `7` |
| `ROUTER_ENDPOINT` | Upstream OpenAI-compatible chat completion URL | `https://your-router-endpoint.com/v1/chat/completions` |
| `ROUTER_API_KEY` | API key for upstream AI completions router | `your-router-api-key` |
| `BREVO_API_KEY` | Brevo API key for transactional email delivery | `xkeysib-...` |
| `BREVO_SENDER_NAME` | Display name for verification emails | `FinTrack` |
| `BREVO_SENDER_EMAIL` | Sender email address for outgoing emails | `no-reply@yourdomain.com` |
| `SEED_ADMIN_EMAIL` | Email for initial administrator account | `admin@fintrack.local` |
| `SEED_ADMIN_PASSWORD` | Default password for initial administrator | `ChangeMe123!` |
| `SEED_DEMO_EMAIL` | Email for pre-populated demo user account | `demo@fintrack.local` |
| `SEED_DEMO_PASSWORD` | Default password for demo user account | `ChangeMe123!` |

---

## 📡 API Endpoints

All endpoints support JSON error formatting and automatic TypeBox validation.

### 1. Authentication (`/auth`)
- `POST /auth/register` — Register a new user account (requires valid invite code).
- `POST /auth/login` — Authenticate user and issue `accessToken` & `refreshToken` HttpOnly cookies.
- `POST /auth/refresh` — Rotate refresh token and issue new session cookies.
- `POST /auth/logout` — Revoke active refresh token and invalidate cookies.
- `GET /auth/me` — Retrieve current authenticated user profile.
- `PUT /auth/me/currency` — Update user's preferred base currency.
- `POST /auth/verify-email` — Verify email address with one-time verification token.
- `POST /auth/resend-verification` — Request a new email verification token.
- `GET /auth/invites` — *(Admin only)* List all generated invite codes and usage stats.
- `POST /auth/invites` — *(Admin only)* Create new invite codes with custom usage limits.
- `DELETE /auth/invites/:id` — *(Admin only)* Revoke an invite code.

### 2. Financial Accounts & Net Worth (`/accounts`)
- `GET /accounts` — List all user accounts with current balances.
- `POST /accounts` — Create a new financial account (e.g. Bank, Cash, Investment, Credit).
- `GET /accounts/:id` — Retrieve specific account details.
- `PATCH /accounts/:id` — Update account properties or balance.
- `DELETE /accounts/:id` — Soft or hard delete an account.
- `GET /accounts/summary/net-worth` — Calculate aggregate Net Worth, total assets, and total liabilities.

### 3. Account Types & Templates (`/account-types`)
- `GET /account-types` — List account categories and types.
- `POST /account-types` — Create custom account types.
- `POST /account-types/sync-templates` — Synchronize system account templates.

### 4. Currencies & Exchange Rates (`/currencies`)
- `GET /currencies` — Catalog of supported world currencies.
- `GET /currencies/rates` — Real-time exchange rate table against USD.
- `POST /currencies/convert` — Perform currency conversion calculations.

### 5. AI Receipt Extraction (`/receipts`)
- `POST /receipts/extract` — Extract itemized data from receipt image (multipart upload or base64 JSON).
- `GET /receipts` — List extracted receipts with pagination.
- `GET /receipts/:id` — Retrieve receipt data and extracted line items by ID.

#### Receipt Extraction Example (cURL):
```bash
curl -X POST http://localhost:3000/receipts/extract \
  -F "image=@/path/to/receipt.jpg"
```

#### Receipt Extraction Example (Fetch):
```typescript
const formData = new FormData();
formData.append("image", fileInput.files[0]);

const response = await fetch("http://localhost:3000/receipts/extract", {
  method: "POST",
  body: formData,
  credentials: "include",
});

const { data } = await response.json();
console.log("Merchant:", data.merchant.name);
console.log("Total:", data.financials.total, data.transaction.currency);
```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `bun dev` | Runs the server with hot-reload (`--watch src/index.ts`) |
| `bun run typecheck` | Validates TypeScript types across all files (`tsc --noEmit`) |
| `bun run db:push` | Synchronizes Drizzle schema changes directly to PostgreSQL |
| `bun run db:generate` | Generates SQL migration files from Drizzle schema definitions |
| `bun run db:migrate` | Applies pending SQL migrations to the database |
| `bun run db:studio` | Launches Drizzle Studio web GUI for visual database management |
| `bun run db:reset` | Interactive prompt to DROP all database tables |
| `bun run db:seed` | Interactive prompt to seed currencies, account templates, and demo users |

> **Tip:** You can pass `-y` to `db:reset` and `db:seed` (e.g. `bun run db:seed -- -y`) to bypass confirmation prompts in automated scripts or CI pipelines.

---

## 🔗 Frontend Client Integration (Eden Treaty)

FinTrack Backend exports an Eden Treaty client factory and its full application type via `src/client.ts`:

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "fintrack-be";

export const api = treaty<App>("http://localhost:3000");

// Fully typed autocompletion with zero codegen:
const { data, error } = await api.accounts["summary"]["net-worth"].get();
```

The companion frontend [**fintrack**](https://github.com/rrydrr/fintrack) uses path aliases (`@backend/client`) that automatically point to this repository during local development, giving you instant autocompletion and compile-time type validation.

---

## 🪵 Logging & Auditing

Logs are automatically organized into two rotating log files under `logs/` (ignored by git):
- `logs/system-YYYY-MM-DD.log`: All server events, lifecycle logs, warnings, and error traces.
- `logs/raw-YYYY-MM-DD.log`: Exclusively contains full raw JSON completions from the upstream AI router for auditing.

---

## 🌐 Related Repositories

- **Frontend Web Dashboard**: [rrydrr/fintrack](https://github.com/rrydrr/fintrack) — Modern Next.js 16 App Router dashboard with React 19, Tailwind CSS v4, and Phosphor Icons.

---

## 🤖 Agent Guidelines

Guidelines, architectural rules, and development standards for AI coding assistants (such as **Google Antigravity** and **OpenCode**) are maintained in [`AGENTS.md`](./AGENTS.md) and [`.agents/rules/`](./.agents/rules/).

---

## 📄 License

This project is licensed under the [**PolyForm Noncommercial License 1.0.0**](https://polyformproject.org/licenses/noncommercial/1.0.0).

- **Permitted Use**: Anyone is free to view, fork, run, and modify this software for **personal study, private entertainment, hobby projects, experimentation, and educational purposes**.
- **Commercial Restriction**: Commercial use, monetized distribution, or integration into commercial services is strictly prohibited without explicit written permission from the copyright holder.

For full license details, see the [LICENSE](./LICENSE) file.