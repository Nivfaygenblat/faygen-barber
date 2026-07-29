-- Make the profiles.role column compatible with the owner/manager/barber/content_editor setup used by the admin system.
alter table public.profiles
  alter column role type text using role::text;

alter table public.profiles
  alter column role set default 'barber';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'manager', 'barber', 'content_editor', 'admin', 'staff'));
