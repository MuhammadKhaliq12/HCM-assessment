# Technical Requirements Document (TRD) — ReadyOn Time-Off Microservice

## 1. Context

ReadyOn is the employee-facing system for requesting time off. **Human Capital Management (HCM)** systems (e.g. Workday, SAP) remain the **source of truth** for authoritative balances and employment dimensions (employee × location).

**Problem:** Two systems must stay consistent when:

- Employees request leave on ReadyOn.
- HCM (or payroll) adjusts balances independently (work anniversary, plan year rollover, corrections).

**Personas**

| Persona | Need |
|--------|------|
| Employee | Accurate balance, fast validation of requests. |
| Manager | Approve/reject requests knowing dimensions and balance were validated against HCM at approval time. |

---

## 2. Challenges

1. **Split writes:** HCM and ReadyOn can both “move” balances; drift is inevitable without reconciliation.
2. **Unreliable upstream:** HCM *should* return errors for bad dimensions or insufficient balance, but responses may be incomplete; ReadyOn must **defensively** validate before and after calls.
3. **Bulk vs realtime:** HCM may push a **full balance corpus**; ReadyOn must also support **realtime** read/write for a single employee × location × leave type.
4. **Approval semantics:** Instant employee feedback vs manager gate vs HCM commit order must be explicit to avoid double deduction or orphan states.

---

## 3. Suggested solution (implemented)

### 3.1 Data model

- **Per employee × location × leave type** balance snapshot in SQLite (`timeOffBalances`).
- **Employees** table for dimension validity.
- **Requests** carry `PENDING_MANAGER` → `APPROVED` / `REJECTED` / `CANCELLED`.
- **Audit:** `balanceSyncLogs` for deductions and corrections; optional **corpus ingest idempotency** via `corpusIngestLogs`.

### 3.2 Request lifecycle

1. `POST /timeoff/request` — validates dates, employee/location, **local** sufficient balance; creates **`PENDING_MANAGER`** (no HCM call yet) so the employee gets immediate structured feedback.
2. `POST /timeoff/requests/:id/approve` (manager API key) — re-validates balance, calls **HCM create**, updates local balance from HCM response, marks **APPROVED**, writes audit log.
3. `POST /timeoff/requests/:id/reject` — **REJECTED** without HCM mutation.
4. Employee `POST /timeoff/requests/:id/cancel` — only while **`PENDING_MANAGER`**.

### 3.3 Sync & HCM → ReadyOn corpus

- **Manual pull:** `POST /sync/manual/:employeeId?locationId=` pulls authoritative balance from HCM and reconciles (HCM wins on numeric conflict).
- **Inbound corpus:** `POST /sync/batch` accepts an array of balance rows (employee × location × leave type × days × optional version), upserts balances, returns per-row errors; supports **`idempotencyKey`** to avoid duplicate application of the same batch.

### 3.4 Webhooks

- `POST /webhooks/hcm` — signed async processing for `balance.updated` / `leave.approved` style events (HCM push).

### 3.5 Observability & API discovery

- **OpenAPI / Swagger UI** at `/api-docs` for interactive testing.

---

## 4. Alternatives considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| **HCM-only validation** (no local balance check) | Simpler code | Slow UX; fails if HCM silent | Rejected |
| **Approve-before-HCM** (manager then HCM) | Manager gate; HCM remains commit point | Two-step UX | **Chosen** |
| **HCM-first then manager** | HCM always has reservation | Complex rollback if manager rejects | Rejected for v1 |
| **Event sourcing** for balances | Full audit replay | Heavy for take-home | Deferred |
| **GraphQL** instead of REST | Flexible queries | Not required by HR integrators | REST only for v1 |

---

## 5. Security notes (v1)

- **Manager operations** require header `x-manager-api-key` matching env `MANAGER_API_KEY` (replace with OAuth2/JWT + RBAC in production).
- **Webhooks** require `HCM_WEBHOOK_SECRET` HMAC when configured.

---

## 6. Out of scope (v1)

- Full identity provider, org hierarchy, delegation chains.
- GraphQL gateway.
- Multi-tenant hard isolation.

---

## 7. References

- Repository `README.md` — runbooks, env vars, scripts.
- OpenAPI: `/api-docs` when the service is running.
