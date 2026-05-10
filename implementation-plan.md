# Implementation Plan

## Phase 1 — Project Setup

- [ ] Initialize backend: Node.js + Express + TypeScript
- [ ] Initialize frontend: React + TypeScript + Vite
- [ ] Configure Tailwind CSS
- [ ] Configure React Router
- [ ] Set up PostgreSQL database (local via Docker Compose)
- [ ] Initialize Prisma and connect to the database
- [ ] Define `User` model (id, name, email, password hash, role: admin | agent, timestamps)
- [ ] Define `Ticket` model (id, subject, body, status: open | resolved | closed, category: general_question | technical_question | refund_request, sender email, assigned agent, timestamps)
- [ ] Define `Message` model — threaded replies on a ticket (id, ticket id, body, sender type: customer | agent, timestamps)
- [ ] Define `Session` model for database-backed auth sessions
- [ ] Run initial Prisma migration
- [ ] Seed script — create the default admin user on first deployment
- [ ] Create `.env` files and document required environment variables
- [ ] Set up shared ESLint + Prettier config across frontend and backend

---

## Phase 2 — Authentication

- [ ] POST `/auth/login` — validate credentials, create session
- [ ] POST `/auth/logout` — destroy session
- [ ] GET `/auth/me` — return current user from session
- [ ] Auth middleware — protect all routes behind a valid session
- [ ] Role middleware — restrict admin-only routes
- [ ] Login page (frontend)
- [ ] Protected route wrapper (frontend)
- [ ] Redirect unauthenticated users to login

---

## Phase 3 — User Management

- [ ] GET `/users` — list all agents (admin only)
- [ ] POST `/users` — create a new agent account (admin only)
- [ ] PATCH `/users/:id` — update agent details (admin only)
- [ ] DELETE `/users/:id` — deactivate an agent (admin only)
- [ ] Agents list page (frontend)
- [ ] Create / edit agent form (frontend)

---

## Phase 4 — Ticket CRUD

- [ ] GET `/tickets` — list tickets with filtering (status, category) and sorting (date, status)
- [ ] GET `/tickets/:id` — ticket detail with full message thread
- [ ] POST `/tickets` — create ticket manually
- [ ] PATCH `/tickets/:id` — update status, category, or assigned agent
- [ ] POST `/tickets/:id/messages` — add a reply to a ticket
- [ ] Ticket list page with filter/sort controls (frontend)
- [ ] Ticket detail page with message thread (frontend)
- [ ] Reply composer on ticket detail page (frontend)
- [ ] Status badge and category label components (frontend)

---

## Phase 5 — AI Features

- [ ] Set up Claude API client (shared service module)
- [ ] Auto-classify ticket category on creation using Claude
- [ ] Generate AI summary for each ticket on creation
- [ ] Generate AI-suggested reply on ticket detail page (on demand)
- [ ] Build and load knowledge base (static file or database table) used as context for AI replies
- [ ] Display AI classification, summary, and suggested reply in the ticket detail UI
- [ ] Allow agent to accept, edit, or discard the suggested reply before sending

---

## Phase 6 — Email Integration

- [ ] Configure inbound email webhook with SendGrid or Mailgun
- [ ] Parse inbound webhook payload → create ticket in the database
- [ ] Match follow-up emails to existing open tickets by thread (using email subject/message ID)
- [ ] Send outbound reply via SendGrid/Mailgun when an agent submits a response
- [ ] Store sent reply as a `Message` record on the ticket
- [ ] Mark ticket as `resolved` when a reply is sent

---

## Phase 7 — Dashboard

- [ ] GET `/dashboard/stats` — return counts by status and category
- [ ] Dashboard page with summary cards (open, resolved, closed counts)
- [ ] Breakdown by category
- [ ] Recent tickets list on the dashboard
- [ ] Quick filters to jump to tickets by status or category

---

## Phase 8 — Polish & Deployment

- [ ] Add input validation on all API endpoints
- [ ] Add consistent error handling and error responses across the backend
- [ ] Handle edge cases: duplicate emails, unknown senders, missing fields
- [ ] Write production `Dockerfile` for backend
- [ ] Write production `Dockerfile` for frontend (static build)
- [ ] Write `docker-compose.yml` for production (backend, frontend, postgres)
- [ ] Configure environment variables for production
- [ ] Deploy to chosen cloud provider (AWS, Railway, or Fly.io)
- [ ] Smoke test all critical flows in production
