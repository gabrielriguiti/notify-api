# notify-api

A production-ready REST API for sending notifications across multiple channels — email, SMS and webhooks — with automatic retry, delivery logging and idempotency.

Built as a portfolio project to demonstrate backend engineering fundamentals: queue-based architecture, clean code organisation, and reliability patterns used in real distributed systems.

---

## What it does

A client sends a `POST /notifications` request with a channel, recipient and message. The API validates the request, saves it to the database and pushes a job to a queue. A background worker picks up the job, calls the appropriate provider (email, SMS or webhook), logs the result and retries automatically if the delivery fails.

```
Client → POST /notifications → Fastify → BullMQ Queue → Worker → Provider (Email / SMS / Webhook)
                                             ↓
                                        PostgreSQL (status + logs)
```

---

## Key concepts demonstrated

**Queue-based architecture** — requests return immediately with a `202 Accepted`. The actual sending happens asynchronously via BullMQ + Redis. This is the pattern behind services like SendGrid, Twilio and AWS SES.

**Strategy pattern** — each channel (email, SMS, webhook) is a separate class implementing the same `INotificationSender` interface. Adding a new channel means creating one new file, with zero changes to existing code.

**Exponential backoff retry** — if a delivery fails, the worker retries after 2s, then 4s, then 8s (configurable). After all attempts are exhausted the notification is marked `FAILED` and moved to a dead-letter queue.

**Idempotency** — each request includes an `idempotencyKey`. If the same key is sent twice, the second request returns `409 Conflict` instead of sending the notification again. This prevents duplicate messages when clients retry on network errors.

**Clean Architecture** — the codebase is split into four layers: `domain` (business rules), `application` (use cases), `infrastructure` (database, queue, providers) and `http` (routes, controllers). Dependencies always point inward — the domain knows nothing about Fastify or Prisma.

**Multi-tenant** — every request is authenticated with a per-tenant API key. Notifications are isolated between tenants.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + TypeScript (strict) |
| HTTP framework | Fastify |
| Queue | BullMQ + Redis |
| Database | PostgreSQL + Prisma ORM |
| Email | Nodemailer / Resend |
| SMS | Twilio (sandbox) |
| Testing | Jest + Supertest |
| Docs | Swagger / OpenAPI |
| Infra | Docker + docker-compose |
| Monorepo | Turborepo |

---

## Project structure

```
notify-api/
├── apps/
│   └── api/
│       └── src/
│           ├── domain/               # Entities, interfaces, value objects
│           │   ├── entities/
│           │   │   └── Notification.ts
│           │   └── interfaces/
│           │       └── INotificationSender.ts
│           ├── application/          # Use cases, orchestration
│           │   └── use-cases/
│           │       └── SendNotificationUseCase.ts
│           ├── infrastructure/       # DB, queue, external providers
│           │   ├── database/
│           │   │   └── PrismaNotificationRepository.ts
│           │   ├── queue/
│           │   │   ├── producer.ts
│           │   │   └── worker.ts
│           │   └── senders/
│           │       ├── EmailSender.ts
│           │       ├── SmsSender.ts
│           │       └── WebhookSender.ts
│           └── http/                 # Routes, controllers, middleware
│               ├── routes/
│               │   └── notifications.route.ts
│               └── middleware/
│                   └── auth.ts
├── packages/
│   └── database/                    # Prisma schema shared across apps
│       └── prisma/
│           └── schema.prisma
├── docker-compose.yml
└── turbo.json
```

---

## Database schema

```prisma
model Tenant {
  id          String    @id @default(cuid())
  name        String
  apiKeys     ApiKey[]
  notifications Notification[]
  createdAt   DateTime  @default(now())
}

model ApiKey {
  id        String   @id @default(cuid())
  key       String   @unique
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
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
}

model NotificationLog {
  id             String       @id @default(cuid())
  notificationId String
  notification   Notification @relation(fields: [notificationId], references: [id])
  attempt        Int
  status         NotificationStatus
  error          String?
  createdAt      DateTime     @default(now())
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
# Clone the repo
git clone https://github.com/gabrielriguiti/notify-api.git
cd notify-api

# Install dependencies
npm install

# Start Postgres and Redis
docker-compose up -d

# Run database migrations and seed
npm run db:migrate
npm run db:seed

# Start the API in dev mode
npm run dev
```

The API will be available at `http://localhost:3000`.  
Swagger docs at `http://localhost:3000/docs`.

---

## API usage

**Send a notification**

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "subject": "Welcome",
    "body": "Hello, your account is ready.",
    "idempotencyKey": "onboarding-user-42"
  }'
```

Response:

```json
{
  "id": "clx1234abc",
  "status": "QUEUED",
  "channel": "EMAIL",
  "recipient": "user@example.com",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Duplicate request (same idempotencyKey)**

```
HTTP 409 Conflict
{ "error": "Notification already exists for this idempotency key" }
```

---

## Running tests

```bash
# Unit tests
npm run test

# Integration tests (requires Docker running)
npm run test:integration
```

---

## Architecture decisions

**Why Fastify instead of Express?**  
Fastify has built-in schema validation with JSON Schema, automatic Swagger generation and is ~35% faster than Express in benchmarks. For an API that validates every incoming request, the schema-first approach reduces boilerplate significantly.

**Why BullMQ instead of a simple async function?**  
Async functions fail silently when the process crashes mid-execution. BullMQ persists jobs in Redis, so if the server restarts between receiving a request and sending the notification, the job is not lost — it will be picked up by the next worker instance.

**Why manual dependency injection instead of a DI container?**  
With four use cases this is the simplest approach that keeps the domain layer free of framework-specific decorators. At scale (10+ use cases), a container like `tsyringe` would be worth adding.

**Why idempotency keys instead of database deduplication?**  
The client controls the key, which means retries (from network timeouts, client-side bugs, etc.) are safe by design. The API does not need to guess whether a request is a duplicate.

---

## What I learned building this

- How to structure a Node.js project that can grow without becoming a mess
- Why queues exist and what problems they solve that promises don't
- How exponential backoff prevents overwhelming a failing provider
- The difference between writing code that works and code that is testable
- How idempotency prevents real-world bugs that only appear under load or unstable networks

---

## Author

Built by Gabriel Riguiti as part of a four-project backend portfolio.  
→ [Portfolio site](#) · [LinkedIn](#) · [Other projects](#)