# HelpDesk — Claude Project Memory

## What this project is

An AI-powered ticket management system that receives support emails, auto-classifies them, generates AI summaries and suggested replies, and lets agents manage tickets through a dashboard.

See `project-scope.md` for full requirements and `implementation-plan.md` for the phased build plan.

## Monorepo structure

```
helpDesk/
├── client/          # React + TypeScript + Vite + Tailwind + React Router
├── server/          # Node.js + Express + TypeScript + Prisma
├── docker-compose.yml
└── implementation-plan.md
```

## Running the project

```bash
# Start PostgreSQL
docker compose up -d

# Server (port 3000)
cd server && bun dev

# Client (port 5173)
cd client && bun dev
```

First-time setup:
```bash
cd server
bunx prisma migrate dev --name init
bun src/prisma/seed.ts   # creates admin@example.com / REDACTED
```

## Key conventions

- All API routes are prefixed with `/api` (e.g. `/api/health`, `/api/tickets`)
- The Vite dev server proxies `/api/*` to `http://localhost:3000` without path rewriting
- Client API calls go through `client/src/lib/api.ts` — use `api.get / post / patch / delete`
- Auth uses database-backed sessions via `@quixo3/prisma-session-store`
- Bun is the runtime and package manager for both `client` and `server`

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express 4, TypeScript |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma 6 |
| AI | Claude API (Anthropic) |
| Email | SendGrid or Mailgun (inbound webhook + outbound) |
| Runtime | Bun |

## Database models

- `User` — id, name, email, passwordHash, role (ADMIN | AGENT)
- `Ticket` — id, subject, body, status (OPEN | RESOLVED | CLOSED), category (GENERAL_QUESTION | TECHNICAL_QUESTION | REFUND_REQUEST), senderEmail, assignedToId
- `Message` — id, ticketId, body, senderType (CUSTOMER | AGENT)
- `Session` — Prisma session store for express-session

## Using context7 for documentation

Always use the context7 MCP server when working with any library or framework in this project. This ensures up-to-date docs rather than relying on training data.

Before writing code that uses a library, resolve its ID and fetch relevant docs:

```
1. mcp__context7__resolve-library-id  →  find the library ID
2. mcp__context7__query-docs          →  fetch the relevant section
```

Libraries to always look up via context7: React, React Router, Vite, Tailwind CSS, Prisma, Express, express-session, Bun, Anthropic SDK, SendGrid, Mailgun.
