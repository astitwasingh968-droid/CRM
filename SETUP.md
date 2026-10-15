# Local setup

## 1. Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 2. Create Supabase project

Create a Supabase project, then copy the project URL and anon/publishable key into `.env.local`.

Run `supabase/schema.sql` in Supabase SQL Editor.

## 3. Create the first admin

In **Supabase > Authentication > Users**, create an email/password user. Copy the user's UUID.

Then run:

```sql
insert into public.profiles (id, full_name, role)
values ('ADMIN_AUTH_UUID', 'Astitwa Singh', 'super_admin');

insert into public.profile_contacts (user_id, email)
values ('ADMIN_AUTH_UUID', 'YOUR_ADMIN_EMAIL');
```

Now sign in at `/login`.

## 4. Create employee and client accounts

Create more Auth users in Supabase Authentication, then create their CRM rows:

```sql
insert into public.profiles (id, full_name, role)
values
  ('EMPLOYEE_AUTH_UUID', 'Rahul Sharma', 'brand_employee'),
  ('CLIENT_AUTH_UUID', 'Nike Client', 'client');

insert into public.profile_contacts (user_id, email)
values
  ('EMPLOYEE_AUTH_UUID', 'employee@example.com'),
  ('CLIENT_AUTH_UUID', 'client@example.com');
```

As the super admin, create a brand in the CRM UI and use **Team workload > Assign user to brand** to link the employee/client to that brand.

## 5. Enable real email notifications (optional)

Create a Resend API key and add:

```env
RESEND_API_KEY=your_key
NOTIFICATION_FROM_EMAIL=AgencyFlow <verified@yourdomain.com>
```

Without this key, ticket creation still works; the app simply reports that email delivery is not configured.

## 6. Recommended interview demo accounts

Create:
- 1 Super Admin
- 2 Brand Employees
- 2 Clients
- 2 Brands

This lets you demonstrate that Brand A users cannot access Brand B rows even if they try to query the database directly through the client SDK.
