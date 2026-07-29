create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists is_active boolean default true,
  add column if not exists last_login_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.app_role not null unique,
  description text,
  is_system boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(user_id, permission_key)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'available' check (status in ('available','booked','blocked','closed')),
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(slot_date, start_time)
);

create table if not exists public.closed_days (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.website_content (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  body text,
  payload jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  logo_url text,
  phone text,
  email text,
  address text,
  whatsapp text,
  instagram_url text,
  business_hours text,
  hero_title text,
  hero_subtitle text,
  about_title text,
  about_body text,
  contact_text text,
  footer_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action_type text not null,
  section text,
  description text not null,
  entity_type text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  change_type text not null,
  description text,
  user_id uuid references public.profiles(id),
  snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_availability_slots_date on public.availability_slots(slot_date);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index if not exists idx_content_versions_created_at on public.content_versions(created_at desc);

create or replace function public.ensure_profile_row()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active, last_login_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'barber', true, now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.ensure_profile_row();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.customers enable row level security;
alter table public.availability_slots enable row level security;
alter table public.closed_days enable row level security;
alter table public.website_content enable row level security;
alter table public.business_settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.content_versions enable row level security;

drop policy if exists "profiles self read" on public.profiles;

create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles owner manage" on public.profiles;

create policy "profiles owner manage" on public.profiles
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager') and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager') and p.is_active));

drop policy if exists "roles public read" on public.roles;

create policy "roles public read" on public.roles
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "permissions read" on public.permissions;

create policy "permissions read" on public.permissions
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "permissions manage" on public.user_permissions;

create policy "permissions manage" on public.user_permissions
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.is_active));

drop policy if exists "customers manage" on public.customers;

create policy "customers manage" on public.customers
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "availability manage" on public.availability_slots;

create policy "availability manage" on public.availability_slots
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "closed days manage" on public.closed_days;

create policy "closed days manage" on public.closed_days
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "content manage" on public.website_content;

create policy "content manage" on public.website_content
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "settings manage" on public.business_settings;

create policy "settings manage" on public.business_settings
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "logs manage" on public.activity_logs;

create policy "logs manage" on public.activity_logs
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

drop policy if exists "versions manage" on public.content_versions;

create policy "versions manage" on public.content_versions
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

insert into public.roles (name, description, is_system) values
  ('owner','Full access to the business admin system',true),
  ('manager','Can manage appointments, services, content, and business settings',true),
  ('barber','Can view and manage appointments and customers',true),
  ('content_editor','Can manage website text, gallery, and services',true)
 on conflict (name) do nothing;

insert into public.permissions (key, description) values
  ('manage_appointments','Manage appointments and availability'),
  ('manage_customers','Manage customers'),
  ('manage_services','Manage services'),
  ('manage_gallery','Manage gallery'),
  ('manage_content','Manage website content'),
  ('manage_settings','Manage business settings'),
  ('manage_users','Manage other users')
 on conflict (key) do nothing;
