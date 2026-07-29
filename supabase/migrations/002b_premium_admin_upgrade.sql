alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists last_activity_at timestamptz default now();
alter table public.gallery_images add column if not exists focal_x numeric default 50 check(focal_x between 0 and 100);
alter table public.gallery_images add column if not exists focal_y numeric default 50 check(focal_y between 0 and 100);
create table if not exists public.audit_logs(id bigint generated always as identity primary key,actor_id uuid references auth.users(id),action text not null,entity_type text,entity_id text,details jsonb default '{}'::jsonb,created_at timestamptz default now());
alter table public.audit_logs enable row level security;
create policy "owners read audit log" on public.audit_logs for select using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='owner' and p.is_active));
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin','staff') and is_active)$$;
update public.services set is_active=false;
insert into public.services(name,description,price,duration_minutes,buffer_minutes,is_active,is_bookable,sort_order) values
('תספורת גבר + זקן','תספורת ועיצוב זקן',60,30,0,true,true,1),
('תספורת + זקן + פלוס שעווה','תספורת, עיצוב זקן ושעווה',65,35,0,true,true,2),
('תספורת בלי זקן','תספורת מדויקת ללא עיצוב זקן',50,30,0,true,true,3),
('זקן','עיצוב וסידור זקן',20,10,0,true,true,4),
('תספורת שיער ארוך / גזירות','גזירות ועיצוב שיער ארוך',70,50,0,true,true,5)
on conflict(name) do update set price=excluded.price,duration_minutes=excluded.duration_minutes,description=excluded.description,is_active=true,is_bookable=true,sort_order=excluded.sort_order;
