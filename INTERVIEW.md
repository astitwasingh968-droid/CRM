# Interview Guide: Agency CRM & Client Portal

## 60-second explanation

I built a multi-client Agency CRM and Client Portal for agencies that manage several brands at the same time. The system has three roles: Super Admin, Brand Employee, and Client. Admins can onboard brands, allocate work, and monitor team workload. Employees can work on tickets for only their assigned brands, and clients can track only the tickets and comments marked as client-visible.

I used Next.js 14 and TypeScript for the application, Supabase Auth for identity, and PostgreSQL for the data layer. The most important part was multi-tenant authorization. Every ticket belongs to a `brand_id`, users are mapped to brands through `brand_members`, and PostgreSQL Row-Level Security decides which rows a logged-in user can read or modify. That means security does not depend only on hiding things in the frontend.

I also built a drag-and-drop Kanban workflow, deadline and workload dashboards, internal versus client-visible comments, PDF reporting, and optional ticket-assignment email notifications.

## Architecture

```text
Browser
  |
  | Supabase authenticated session
  v
Next.js 14 App Router
  |-- Login / protected dashboard
  |-- Admin / employee / client UI
  |-- /api/notify for transactional email
  |
  v
Supabase
  |-- Auth
  |-- PostgreSQL
       |-- profiles
       |-- profile_contacts
       |-- brands
       |-- brand_members
       |-- tickets
       |-- comments
       |-- RLS policies
```

## Main database relationship

```text
profiles ----< brand_members >---- brands ----< tickets ----< comments
                                              |
                                              +---- assigned_to -> profiles
```

## Strong interview questions

### Why Next.js instead of only React?
Next.js let me keep routing, UI, middleware, and server endpoints in one application. For this project I needed protected routes and a server-only notification endpoint, so using Next.js reduced the need for a separate Express application.

### Why Supabase?
I wanted PostgreSQL plus authentication, but I still wanted direct access to PostgreSQL features. Supabase gave me Auth and a Postgres database while allowing me to use Row-Level Security for real authorization.

### What is the difference between authentication and authorization here?
Authentication answers who the user is; Supabase Auth handles that. Authorization answers what that user can access. I enforce authorization with role checks, brand membership, and PostgreSQL RLS policies.

### How do you stop a Nike user from reading Adidas data?
Every ticket has a brand ID. Users are linked to authorized brands in `brand_members`. RLS checks the authenticated user's ID before returning any ticket row. Even if a user manually changes a frontend request, PostgreSQL will not return rows for a brand they are not authorized to access.

### Why not just filter tickets in React?
Frontend filtering is only a UI concern and can be bypassed. I filter in the UI for usability, but RLS is the actual security boundary.

### How does the Kanban board work?
Each ticket stores a status: `todo`, `in_progress`, `review`, or `done`. The Kanban columns represent those states. When a card is dragged to another column, the application updates the ticket status in PostgreSQL and performs an optimistic UI update.

### How does the client portal differ from the employee portal?
Clients can only read tickets marked `client_visible`. Comments also have `internal` or `client_visible` visibility. The database policy prevents a client account from receiving internal notes, even if they manually call the API.

### How do workload dashboards work?
The dashboard groups open tickets by `assigned_to`. This makes it possible to compare active workload for each employee and identify overloaded team members.

### What was the hardest part?
The hardest part was the authorization model because there are multiple roles and multiple brands. I had to make sure access control was consistent for tickets, comments, users, and brands, not just visually hidden in the interface.

### What would you add for production?
I would add audit logs, attachment storage, automated tests, invitation flows, scheduled deadline reminders, rate limiting, observability, and background job processing.

## Demo flow

1. Login as Super Admin.
2. Create Brand A and Brand B.
3. Link Employee A and Client A to Brand A.
4. Link Employee B and Client B to Brand B.
5. Create tickets for both brands.
6. Drag a ticket through the Kanban board.
7. Add an internal comment and a client-visible comment.
8. Login as Client A and show that only Brand A client-visible information appears.
9. Export a PDF report.
10. Explain that RLS, not frontend filtering, enforces the isolation.
