create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('super_admin','brand_employee','client')),
  created_at timestamptz not null default now()
);

create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null unique
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_members (
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  primary key (user_id, brand_id)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  brand_id uuid not null references public.brands(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  deadline date,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  visibility text not null default 'internal' check (visibility in ('internal','client_visible')),
  created_at timestamptz not null default now()
);

create index if not exists tickets_brand_idx on public.tickets(brand_id);
create index if not exists tickets_assigned_idx on public.tickets(assigned_to);
create index if not exists tickets_deadline_idx on public.tickets(deadline);
create index if not exists comments_ticket_idx on public.comments(ticket_id);
create index if not exists brand_members_brand_idx on public.brand_members(brand_id);

-- Security-definer helpers centralize tenant checks and avoid recursive RLS policies.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_brand_member(target_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brand_members
    where brand_id = target_brand and user_id = (select auth.uid())
  )
$$;

create or replace function public.shares_brand_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members mine
    join public.brand_members theirs on theirs.brand_id = mine.brand_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user
  )
$$;

create or replace function public.is_employee_for_brand(target_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members m
    join public.profiles p on p.id = m.user_id
    where m.brand_id = target_brand
      and m.user_id = (select auth.uid())
      and p.role = 'brand_employee'
  )
$$;

create or replace function public.can_read_ticket(target_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role() = 'super_admin'
    or exists (
      select 1
      from public.tickets t
      join public.brand_members m on m.brand_id = t.brand_id
      where t.id = target_ticket
        and m.user_id = (select auth.uid())
        and (public.current_role() <> 'client' or t.client_visible = true)
    )
$$;

revoke all on function public.current_role() from public;
revoke all on function public.is_brand_member(uuid) from public;
revoke all on function public.shares_brand_with(uuid) from public;
revoke all on function public.is_employee_for_brand(uuid) from public;
revoke all on function public.can_read_ticket(uuid) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_brand_member(uuid) to authenticated;
grant execute on function public.shares_brand_with(uuid) to authenticated;
grant execute on function public.is_employee_for_brand(uuid) to authenticated;
grant execute on function public.can_read_ticket(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.tickets enable row level security;
alter table public.comments enable row level security;

-- Profiles: users see themselves; admins see everyone; users can resolve names of people in their brand.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or public.current_role() = 'super_admin'
  or public.shares_brand_with(id)
);

-- Contact emails are more restricted than profile names.
drop policy if exists "contacts_select" on public.profile_contacts;
create policy "contacts_select" on public.profile_contacts
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.current_role() = 'super_admin'
  or (public.current_role() = 'brand_employee' and public.shares_brand_with(user_id))
);

drop policy if exists "contacts_insert" on public.profile_contacts;
create policy "contacts_insert" on public.profile_contacts
for insert to authenticated
with check (user_id = (select auth.uid()) or public.current_role() = 'super_admin');

drop policy if exists "contacts_update" on public.profile_contacts;
create policy "contacts_update" on public.profile_contacts
for update to authenticated
using (user_id = (select auth.uid()) or public.current_role() = 'super_admin')
with check (user_id = (select auth.uid()) or public.current_role() = 'super_admin');

-- Brands.
drop policy if exists "brands_select" on public.brands;
create policy "brands_select" on public.brands
for select to authenticated
using (public.current_role() = 'super_admin' or public.is_brand_member(id));

drop policy if exists "brands_insert" on public.brands;
create policy "brands_insert" on public.brands
for insert to authenticated
with check (public.current_role() = 'super_admin');

drop policy if exists "brands_update" on public.brands;
create policy "brands_update" on public.brands
for update to authenticated
using (public.current_role() = 'super_admin')
with check (public.current_role() = 'super_admin');

-- Brand membership.
drop policy if exists "members_select" on public.brand_members;
create policy "members_select" on public.brand_members
for select to authenticated
using (
  public.current_role() = 'super_admin'
  or user_id = (select auth.uid())
  or public.is_brand_member(brand_id)
);

drop policy if exists "members_insert" on public.brand_members;
create policy "members_insert" on public.brand_members
for insert to authenticated
with check (public.current_role() = 'super_admin');

drop policy if exists "members_delete" on public.brand_members;
create policy "members_delete" on public.brand_members
for delete to authenticated
using (public.current_role() = 'super_admin');

-- Tickets: clients only receive client-visible rows; employees receive their brand rows; admin receives all.
drop policy if exists "tickets_select" on public.tickets;
create policy "tickets_select" on public.tickets
for select to authenticated
using (
  public.current_role() = 'super_admin'
  or (
    public.is_brand_member(brand_id)
    and (public.current_role() <> 'client' or client_visible = true)
  )
);

drop policy if exists "tickets_insert" on public.tickets;
create policy "tickets_insert" on public.tickets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (public.current_role() = 'super_admin' or public.is_employee_for_brand(brand_id))
  and (
    assigned_to is null
    or exists (
      select 1 from public.brand_members bm
      where bm.user_id = assigned_to and bm.brand_id = tickets.brand_id
    )
  )
);

drop policy if exists "tickets_update" on public.tickets;
create policy "tickets_update" on public.tickets
for update to authenticated
using (public.current_role() = 'super_admin' or public.is_employee_for_brand(brand_id))
with check (
  (public.current_role() = 'super_admin' or public.is_employee_for_brand(brand_id))
  and (
    assigned_to is null
    or exists (
      select 1 from public.brand_members bm
      where bm.user_id = assigned_to and bm.brand_id = tickets.brand_id
    )
  )
);

-- Employees can update only status; admins can update all ticket fields.
create or replace function public.guard_ticket_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.current_role() <> 'super_admin' then
    if (new.title, new.description, new.brand_id, new.assigned_to, new.created_by, new.priority, new.deadline, new.client_visible, new.created_at)
       is distinct from
       (old.title, old.description, old.brand_id, old.assigned_to, old.created_by, old.priority, old.deadline, old.client_visible, old.created_at)
    then
      raise exception 'Brand employees can only change ticket status';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guard_ticket_update_trigger on public.tickets;
create trigger guard_ticket_update_trigger
before update on public.tickets
for each row execute function public.guard_ticket_update();

-- Comments: users must have access to the parent ticket. Clients never receive internal notes.
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
for select to authenticated
using (
  public.can_read_ticket(ticket_id)
  and (public.current_role() <> 'client' or visibility = 'client_visible')
);

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_read_ticket(ticket_id)
  and (public.current_role() <> 'client' or visibility = 'client_visible')
);
