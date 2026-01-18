# AI Notes Template Builder

A Next.js + Prisma + PostgreSQL project for building dynamic, AI-generated note templates (budget trackers, health logs, schedules, etc.) with structured data storage. The long-term goal is to allow an AI assistant to create and evolve templates while preserving user data.

---

## Tech Stack

* **Next.js (App Router)**
* **TypeScript**
* **Prisma ORM**
* **PostgreSQL (Docker)**
* **Tailwind CSS**
* **Node.js 18+**
* **Docker Desktop (Apple Silicon compatible)**

---

## Project Structure

```
ai-notes-template-builder/
├─ src/
│  ├─ app/api/
│  │  ├─ templates/route.ts
│  │  ├─ collections/route.ts
│  │  └─ records/route.ts
│  ├─ lib/db.ts
│  └─ generated/prisma/
├─ prisma/
│  └─ schema.prisma
├─ docker-compose.yml
├─ .env
├─ package.json
└─ README.md
```

---

## Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notes?schema=public"
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

---

### 2. Start Docker Desktop

Docker Desktop **must be running**.

```bash
open -a Docker
docker ps
```

You should **not** see a Docker socket error.

---

### 3. Start PostgreSQL (Docker)

```bash
docker compose up -d
```

Verify:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
nc -vz localhost 5432
```

Expected:

* `notes-db` container running
* Port `5432` mapped
* `nc` connection succeeds

---

### 4. Verify database exists

```bash
docker exec -it notes-db psql -U postgres -c "\\l"
```

If `notes` does not exist:

```bash
docker exec -it notes-db createdb -U postgres notes
```

---

### 5. Run Prisma migrations

```bash
npx prisma migrate dev
```

Expected:

* Prisma connects to `localhost:5432`
* Schema is applied
* Prisma Client generated to `src/generated/prisma`

---

### 6. Start the development server

```bash
npm run dev
```

App available at:

```
http://localhost:3000
```

---

## API Usage (Manual Testing)

### Create a Template

```bash
curl -s -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Budget Tracker",
    "spec":{
      "name":"Budget Tracker",
      "schema":{"fields":[
        {"id":"date","label":"Date","type":"date","required":true},
        {"id":"amount","label":"Amount","type":"number","required":true},
        {"id":"category","label":"Category","type":"text"}
      ]},
      "views":[{"id":"table","type":"table","default":true}]
    }
  }' | jq
```

---

### Create a Collection

```bash
curl -s -X POST http://localhost:3000/api/collections \
  -H "Content-Type: application/json" \
  -d '{"name":"My Budget","templateId":"TEMPLATE_ID"}' | jq
```

---

### Create a Record

```bash
curl -s -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "collectionId":"COLLECTION_ID",
    "data":{"date":"2026-01-09","amount":42.5,"category":"Food"}
  }' | jq
```

---

### List Records

```bash
curl -s "http://localhost:3000/api/records?collectionId=COLLECTION_ID" | jq
```

---

### Fetch Collection + Template

```bash
curl -s "http://localhost:3000/api/collections?id=COLLECTION_ID" | jq
```

---

## Troubleshooting

### Docker daemon not running

```text
Cannot connect to the Docker daemon
```

Fix:

```bash
open -a Docker
docker ps
```

---

### Prisma cannot reach database

```text
Can't reach database server at localhost:5432
```

Fix:

```bash
docker ps
nc -vz localhost 5432
npx prisma migrate dev
```

---

### Prisma Client not initialized

```text
@prisma/client did not initialize yet
```

Fix:

```bash
npx prisma generate
```

Ensure import path:

```ts
import { PrismaClient } from "@/generated/prisma";
```

---

### Foreign key constraint failed (P2003)

Cause:

* Invalid `templateId` or `collectionId`

Fix:

* Create Template → Collection → Record in order
* Do not reuse placeholder IDs

---

## Current Status

* Database schema finalized
* API routes functional
* Docker + Prisma stable
* Ready for TemplateSpec validation, UI rendering, and AI integration
