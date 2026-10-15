# AgencyFlow CRM & Client Portal

A multi-client agency CRM built to demonstrate production-style full-stack concepts: authentication, multi-tenant authorization, PostgreSQL Row-Level Security, ticket operations, Kanban workflow, deadlines, workload tracking, client communication, PDF reporting, and optional email notification delivery.

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase
- PostgreSQL Row-Level Security
- dnd-kit for Kanban drag-and-drop
- jsPDF for report export
- Resend REST API for optional ticket assignment emails

## Implemented features

### Authentication and authorization
- Email/password login with Supabase Auth
- Super Admin, Brand Employee, and Client roles
- Protected `/dashboard` route with session-refresh middleware
- Database-level brand isolation using PostgreSQL RLS
- Client accounts only receive `client_visible` tickets/comments

### Agency operations
- Brand onboarding
- Brand membership assignment for existing users
- Ticket creation with brand, assignee, priority, deadline, and client visibility
- Searchable ticket management table
- Kanban drag-and-drop with persistent status updates
- Workload dashboard for brand employees
- Overdue and due-soon deadline monitoring

### Client portal
- Client-specific dashboard using the same secured data layer
- Client-visible tickets only
- Ticket conversations where internal notes are hidden from clients by RLS

### Reporting and notifications
- PDF export of the current user's visible ticket report
- Authenticated `/api/notify` endpoint
- Optional Resend email when a ticket is assigned
- Contact email table with tighter RLS than public profile names

## Why the security model matters

The UI is not the security boundary. Every ticket has a `brand_id`, users are mapped to brands through `brand_members`, and PostgreSQL RLS checks the authenticated user's role/membership before returning rows. A user cannot bypass tenant isolation by editing frontend code or manually calling the Supabase client.

## Quick start

See [SETUP.md](./SETUP.md).

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Suggested interview explanation

> I built a multi-client agency CRM because agencies often manage tasks, deadlines, employees, and client communication across several brands. I used Next.js and TypeScript for the application, Supabase Auth for identity, and PostgreSQL with Row-Level Security for authorization. Every ticket belongs to a brand, and users are mapped to permitted brands. The important part is that tenant isolation is enforced in PostgreSQL instead of relying on frontend filtering. I also built a Kanban workflow, workload/deadline dashboards, a client-facing portal with internal versus client-visible comments, PDF reporting, and ticket assignment email notifications.

## Resume bullets supported by this codebase

- Built a multi-client CRM covering brand onboarding, task ticketing, workload tracking, deadline management, and client-facing portals.
- Implemented Supabase Auth, role-based authorization, and PostgreSQL Row-Level Security for Super Admin, brand teams, and clients.
- Developed a Kanban workflow with drag-and-drop task movement, deadlines, centralized allocation, and brand-scoped task visibility.
- Added workload dashboards, ticket management, PDF export, and email notifications for day-to-day operational workflows.

## Production improvements you can discuss

For a real agency deployment, the next steps would be audit logs, attachments/object storage, invitation emails, rate limiting, automated tests, Sentry/observability, background jobs for deadline reminders, and a dedicated transactional-email domain.
