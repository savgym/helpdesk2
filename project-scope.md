# AI-Powered Ticket Management System

## Problem

We receive hundreds of support emails daily. Our agents manually
read, classify, and respond to each ticket which is slow and
leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically
classify, respond to, and route support tickets - delivering
faster, more personalized responses to students while freeing up
agents for complex issues.

## Features

- Receive support emails and create tickets
- Auto-generate human-friendly responses using a knowledge base
- Ticket list with filtering and sorting
- Ticket detail view
- AI-powered ticket classification
- AI summaries
- AI-suggested replies
- User management (admin only)
- Dashboard to view and manage all tickets

## Ticket Statuses

- **Open** — ticket has been received and is awaiting action
- **Resolved** — ticket has been responded to and the issue is considered handled
- **Closed** — ticket is fully closed and no further action is needed

## Ticket Categories

- General Question
- Technical Question
- Refund Request

## Tech Stack

See [tech-stack.md](./tech-stack.md) for the full breakdown.

## User Roles

- **Admin** — the system is seeded with a single admin on first deployment; can create and manage agent accounts
- **Agent** — created by the admin; handles and responds to tickets
