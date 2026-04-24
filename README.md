# ReadyOn Time-Off Microservice

NestJS 10 + SQLite time-off service with outbound HCM integration, inbound webhooks, corpus ingest, manager approval flow, Swagger UI, Jest tests, and a standalone mock HCM server.

---

## Submission checklist (README requirement)

**This repository includes a `README.md` with clear instructions to set up and run the solution.** Follow the steps below on a clean machine:

1. Install **Node.js 18+** and **npm**.
2. Copy **`.env.example`** → **`.env`** and set the variables in the table (at minimum the secrets).
3. Run **`npm install`**, **`npm run build`**, **`npm run typeorm:migration:run`**.
4. Start **mock HCM** and the **API** (two terminals, or use Docker Compose).
5. Optionally run **`npm test`**, **`npm run test:e2e`**, and **`npm run test:cov`** to verify the build.

---

## Prerequisites

| Tool | Version / notes |
|------|------------------|
| Node.js | **18+** (matches `Dockerfile` / `mock-hcm/Dockerfile`) |
| npm | **9+** recommended |
| Docker Desktop | Optional; only for **Docker Compose** |

---

## Environment variables

Create a `.env` file in the **project root** (same folder as `package.json`):

```bash
# Windows (CMD)
copy .env.example .env

# macOS / Linux / Git Bash
cp .env.example .env
```

Then edit `.env`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `HCM_API_URL` | Yes | Mock or real HCM base URL (local mock: `http://localhost:3001`) |
| `HCM_API_KEY` | Yes | Outbound HCM calls send header `x-api-key` |
| `MANAGER_API_KEY` | Yes | Must match header `x-manager-api-key` on manager approve/reject routes |
| `HCM_WEBHOOK_SECRET` | Yes | Validates `POST /webhooks/hcm` signatures; mock uses the same value when posting drift events |
| `READYON_WEBHOOK_URL` | No | Target for mock HCM drift webhooks (e.g. `http://localhost:3000/webhooks/hcm`) |
| `DB_PATH` | Yes | SQLite path (default `./data/timeoff.sqlite`) |
| `PORT` | No | API port (default `3000`) |
| `MOCK_HCM_INJECT_FAILURES` | No | Mock only: `true` / `false` for latency/error injection |
| `TYPEORM_LOGGING` | No | Set `true` for extra TypeORM logs |

**Do not commit `.env`** (it is in `.gitignore`). For assessment ZIPs you may omit `.env` and rely on `.env.example`; reviewers copy it and fill values locally.

---

## Setup and run (local, without Docker)

### 1) Install and build

```bash
npm install
npm run build
npm run typeorm:migration:run
```

The `data/` folder is kept in repo (with `.gitkeep`) so SQLite can be created under `./data` when `DB_PATH` points there.

### 2) Terminal A — Mock HCM (port 3001)

```bash
npm run build:mock-hcm
npm run start:mock-hcm
```

The mock server loads the **repo root `.env`** when the file exists, so `HCM_WEBHOOK_SECRET` and `READYON_WEBHOOK_URL` stay in sync with the main app.

### 3) Terminal B — API

```bash
npm run start:dev
```

Or production-style (after `npm run build`):

```bash
npm run start
```

### 4) Verify in browser

- **Swagger UI:** `http://localhost:3000/api-docs` (use your `PORT` if changed).
- Click **Authorize**, set **`x-manager-api-key`** to the same value as `MANAGER_API_KEY` in `.env`, then try manager routes.

---

## Setup and run (Docker Compose)

1. Put a `.env` file **next to** `docker-compose.yml` with at least `HCM_API_KEY`, `MANAGER_API_KEY`, and `HCM_WEBHOOK_SECRET` (same names as `.env.example`). Docker Compose reads this file for `${VAR}` substitution.
2. Start everything:

```bash
docker compose up --build
```

- **API:** http://localhost:3000  
- **Swagger:** http://localhost:3000/api-docs  
- **Mock HCM:** http://localhost:3001  

If a variable is missing from `.env`, Compose uses the **defaults** shown in `docker-compose.yml` (suitable for a quick smoke test; use strong unique values for anything serious).

---

## Database

- **Migrations:** `src/db/migrations/`  
- **SQL reference:** `src/db/schema/schema.sql`  

```bash
npm run typeorm:migration:run
npm run typeorm:migration:revert   # if you need to roll back the last migration
```

---

## Testing

```bash
npm install    # if not already done
npm test       # unit tests (Jest, under src/)
npm run test:e2e    # integration tests (test/integration/)
npm run test:cov    # coverage; thresholds in jest.config.js
npm run test:watch  # optional
```

After `npm run test:cov`, open **`coverage/index.html`** for the HTML report.

---

## REST API (summary)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/timeoff/request` | Creates `PENDING_MANAGER` request |
| GET | `/timeoff/requests/:employeeId` | List requests |
| GET | `/timeoff/balance/:employeeId/:locationId` | Cached balance |
| POST | `/timeoff/requests/:id/approve` | Header `x-manager-api-key` |
| POST | `/timeoff/requests/:id/reject` | Header `x-manager-api-key` |
| POST | `/timeoff/requests/:id/cancel` | Body: `{ "employeeId": "..." }` |
| POST | `/sync/manual/:employeeId` | Query `locationId` required |
| POST | `/sync/batch` | HCM → ReadyOn balance corpus ingest |
| GET | `/sync/status/:employeeId` | Sync health hint |
| POST | `/webhooks/hcm` | Inbound HCM webhooks |

Full schemas and “Try it out”: **`/api-docs`**.

---

## Mock HCM (`:3001`) — routes used by the service

- `GET /mock/health`  
- `GET /mock/balance/:empId/:locId`  
- `POST /mock/timeoff/create`  
- `POST /mock/balance/sync`  
- `POST /mock/balance/refresh/:empId`  
- `POST /mock/simulate-drift`  
- `POST /mock/reset`  

Legacy aliases (`/hcm/...`) may still exist; prefer `/mock/...`.

---

## Design document

- **`docs/TRD.md`** — context, trade-offs, and security notes.

---

## Project layout

```text
src/                      # NestJS application source
src/db/migrations/        # TypeORM migrations
test/integration/         # Supertest API integration tests
test/fixtures/            # Webhook signing helpers, etc.
test/create-integration-app.ts
mock-hcm/                 # Standalone Express mock HCM (own package.json)
Dockerfile
docker-compose.yml
.env.example              # Template for local / Docker env
```

---

## Package managers (npm + Yarn)

This repo ships **`package-lock.json`** (npm) and **`yarn.lock`** (Yarn v1). Pick one primary workflow; if Yarn warns about mixed lockfiles, that is expected.

---

## What to omit from a submission ZIP (optional hygiene)

These are **regenerated** or **local-only**; omit them to keep the ZIP small (reviewers run `npm install` / `npm run build` per above):

- `node_modules/`
- `dist/`
- `coverage/`
- `data/*.sqlite` and journal files
- `.env` (optional: omit secrets; keep `.env.example` only)

---

## Error handling

Custom HTTP exceptions live under `src/common/exceptions/` and are normalized by `GlobalExceptionFilter`. Failed requests are also logged via `ErrorLoggingMiddleware`.

---

## Stack

- NestJS 10+, TypeORM, SQLite (`sqlite3`), Axios (retries + backoff), class-validator, `@nestjs/swagger`  
- Jest + Supertest  
- Docker multi-stage builds  
