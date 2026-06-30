# notify-api

A production-ready REST API for sending notifications across multiple channels — email, SMS and webhooks — with automatic retry, delivery logging and idempotency.

Built as a portfolio project to demonstrate backend engineering fundamentals: queue-based architecture, clean code organisation, and reliability patterns used in real distributed systems.

---

## What it does

A client sends a `POST /notifications` request with a channel, recipient and message. The API authenticates the request, validates it, saves it to the database and pushes a job to a queue. A background worker picks up the job, calls the appropriate provider (email, SMS or webhook), logs the result and retries automatically if the delivery fails.

```
Client → POST /notifications → Fastify → BullMQ Queue → Worker → Provider (Email / SMS / Webhook)
                                             ↓
                                        PostgreSQL (status + logs)
```

The request returns `202 Accepted` immediately — the actual send happens asynchronously. This is the same pattern used by SendGrid, Twilio and AWS SES under the hood.

---

## Key concepts demonstrated

**Queue-based architecture** — requests don't wait for the notification to be sent. They're persisted as `PENDING`, queued, and the worker processes them independently of the request/response cycle.

**Strategy pattern** — each channel (email, SMS, webhook) is a separate class implementing the same `INotificationSender` interface. Adding a new channel means creating one new file, with zero changes to existing code.

**Exponential backoff retry** — if a delivery fails, the worker retries after 2s, then 4s, then 8s. After all attempts are exhausted the notification is marked `FAILED`.

**Idempotency** — each request includes an `idempotencyKey`. If the same key is sent twice, the second request returns `409 Conflict` instead of sending the notification again.

**Clean Architecture** — the codebase is split into four layers: `domain` (business rules), `application` (use cases), `infrastructure` (database, queue, providers) and `http` (routes, controllers). Dependencies always point inward — the domain knows nothing about Fastify or Prisma.

**State machine integrity** — the `Notification` entity enforces valid status transitions (`PENDING → QUEUED → DELIVERED`) and throws if a transition is skipped. This caught a real bug during development (see below).

**Layered request validation** — four independent layers reject bad requests as early as possible, before any business logic runs.

**Multi-tenant** — every request is authenticated with a per-tenant API key. Notifications are isolated between tenants.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + TypeScript (strict) |
| HTTP framework | Fastify |
| Validation | Zod |
| Queue | BullMQ + Redis (ioredis) |
| Database | PostgreSQL + Prisma ORM |
| Email (mock for now) | Custom mock sender, Resend planned for Week 2 |
| Testing | Jest |
| Infra | Docker + docker-compose |
| Monorepo | Turborepo |

---

## Project structure

```
notify-api/
├── apps/
│   └── api/
│       └── src/
│           ├── domain/
│           │   ├── entities/
│           │   │   ├── Notification.ts
│           │   │   └── Notification.test.ts
│           │   └── interfaces/
│           │       ├── INotificationSender.ts
│           │       └── INotificationRepository.ts
│           ├── application/
│           │   └── use-cases/
│           │       ├── SendNotificationUseCase.ts
│           │       └── SendNotificationUseCase.test.ts
│           ├── infrastructure/
│           │   ├── database/
│           │   │   └── PrismaNotificationRepository.ts
│           │   ├── queue/
│           │   │   ├── connection.ts
│           │   │   ├── notification.queue.ts
│           │   │   └── notification.worker.ts
│           │   └── senders/
│           │       ├── MockEmailSender.ts
│           │       ├── MockSmsSender.ts
│           │       └── MockWebhookSender.ts
│           └── http/
│               ├── routes/
│               │   └── notifications.route.ts
│               └── middleware/
│                   └── auth.ts
├── packages/
│   └── database/
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
├── docker-compose.yml
└── turbo.json
```

---

## Database schema

```prisma
model Tenant {
  id            String         @id @default(cuid())
  name          String
  apiKeys       ApiKey[]
  notifications Notification[]
  createdAt     DateTime       @default(now())
}

model ApiKey {
  id        String   @id @default(cuid())
  key       String   @unique
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Notification {
  id             String             @id @default(cuid())
  tenantId       String
  tenant         Tenant             @relation(fields: [tenantId], references: [id])
  channel        Channel
  recipient      String
  subject        String?
  body           String
  idempotencyKey String             @unique
  status         NotificationStatus @default(PENDING)
  logs           NotificationLog[]
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@index([tenantId, status])
  @@index([idempotencyKey])
}

model NotificationLog {
  id             String             @id @default(cuid())
  notificationId String
  notification   Notification       @relation(fields: [notificationId], references: [id])
  attempt        Int
  status         NotificationStatus
  error          String?
  createdAt      DateTime           @default(now())
}

enum Channel {
  EMAIL
  SMS
  WEBHOOK
}

enum NotificationStatus {
  PENDING
  QUEUED
  DELIVERED
  FAILED
  CANCELLED
}
```

---

## Running locally

**Prerequisites:** Node.js 18+, Docker Desktop

```bash
git clone https://github.com/gabrielriguiti/notify-api.git
cd notify-api

npm install

docker-compose up -d

cd packages/database
npx prisma migrate dev --name init
npm run db:seed
cd ../..

cd apps/api
npm run dev
```

The API runs at `http://localhost:3000`. The seed creates a dev tenant with API key `dev-api-key-12345`.

---

## API usage

**Send a notification**

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key-12345" \
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "subject": "Welcome",
    "body": "Hello, your account is ready.",
    "idempotencyKey": "onboarding-user-42"
  }'
```

Response — `202 Accepted`:

```json
{
  "id": "39719be1-9e34-44f9-b999-c1e17c15d8a1",
  "status": "QUEUED",
  "channel": "EMAIL",
  "recipient": "user@example.com",
  "createdAt": "2026-06-30T14:53:23.179Z"
}
```

### Request validation layers

Every request passes through four independent checks, in order, each failing fast before the next one runs:

| Layer | Failure case | Response |
|---|---|---|
| Fastify content-type parser | Missing or wrong `Content-Type` header | `415 Unsupported Media Type` |
| Auth middleware | Missing or invalid `x-api-key` | `401 Unauthorized` |
| Zod schema | Missing/invalid fields in body | `400 Bad Request` with per-field errors |
| Use case (idempotency check) | Duplicate `idempotencyKey` | `409 Conflict` |

Example — missing fields, authenticated request:

```bash
curl -i -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key-12345" \
  -d '{}'
```

```json
HTTP/1.1 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "channel": ["Required"],
      "recipient": ["Required"],
      "body": ["Required"],
      "idempotencyKey": ["Required"]
    }
  }
}
```

**Duplicate request (same idempotencyKey):**

```
HTTP 409 Conflict
{ "error": "Notification already exists for this idempotency key" }
```

---

## Running tests

```bash
cd apps/api
npx jest
```

Domain entity and use case tests run with in-memory fakes — no database, no Redis, no Docker required. Full suite runs in under a second.

---

## Architecture decisions

**Why Fastify instead of Express?**
Fastify has built-in schema validation, automatic content-type enforcement, and is faster than Express in benchmarks. The `415` response on a malformed request body comes for free from Fastify's content-type parser, before any custom code runs.

**Why BullMQ instead of a simple async function?**
Async functions fail silently when the process crashes mid-execution. BullMQ persists jobs in Redis — if the server restarts between receiving a request and sending the notification, the job is not lost.

**Why does the use case only persist as `PENDING` instead of sending directly?**
Initially the use case called the sender directly. After introducing the queue, that became a layering violation: the use case shouldn't know whether sending happens synchronously or asynchronously. Its responsibility was narrowed to "validate and persist"; the worker became the only thing that knows about sending.

**Why does the entity enforce status transitions?**
During development, the worker tried to call `markAsDelivered()` on a notification that was still `PENDING` — it had never passed through `QUEUED`. The entity correctly rejected this instead of silently corrupting the state:

```
[Worker] Job 1 falhou (tentativa 1): Cannot deliver a notification with status "PENDING"
```

The fix was in the worker, not the entity — it now explicitly transitions the notification to `QUEUED` before attempting delivery, and only does so once (skipping it on retries where the status is already `QUEUED`). The entity's job is exactly this: catch invalid transitions caused by bugs elsewhere, rather than allowing the database to end up in an inconsistent state.

**Why manual dependency injection instead of a DI container?**
With a handful of use cases this is the simplest approach that keeps the domain layer free of framework-specific decorators.

**Why idempotency keys instead of database deduplication?**
The client controls the key, which means retries (from network timeouts, client-side bugs, etc.) are safe by design. The API does not need to guess whether a request is a duplicate.

---

## What I learned building this

- How to structure a layered Node.js project where dependencies only point inward
- Why queues exist and what problems they solve that promises don't
- How exponential backoff prevents overwhelming a failing provider
- Why an entity enforcing its own state transitions catches real integration bugs, not just theoretical ones. I hit this directly: a layering change between the use case and the worker left a gap where the worker tried to skip the `QUEUED` state, and the entity refused instead of silently corrupting data
- The difference between writing code that works and code that fails safely when it doesn't
- How idempotency prevents real-world bugs that only appear under load or unstable networks

---

## Roadmap

- [x] Foundation — monorepo, domain layer, use case, HTTP route, auth, queue + worker with retry
- [ ] Real email provider (Resend), webhook sender with HTTP retry, template system
- [ ] Integration tests with Supertest, Swagger/OpenAPI docs, CI, final Docker image

---

## Author

Built by Gabriel Riguiti as part of a four-project backend portfolio.
→ [Portfolio site](#) · [LinkedIn](#) · [Other projects](#)