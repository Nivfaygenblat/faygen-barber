# Owner setup for the admin login

This project already expects an authenticated Supabase user plus a matching profile row in the public.profiles table.

## 1) Create the owner account in Supabase Auth

1. Open your Supabase project dashboard.
2. Go to Authentication > Users.
3. Click Add user.
4. Choose Email and password.
5. Enter the owner email, for example: owner@faygenbarber.com
6. Set a strong password.
7. Click Add user.

If you want the user to be able to reset the password later, you can also enable email confirmation in Authentication > Settings, but it is not required for local testing.

## 2) Add the matching owner profile row

Run this SQL in Supabase SQL Editor after the user is created:

```sql
insert into public.profiles (id, email, full_name, role, is_active)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Owner'), 'owner', true
from auth.users
where email = 'owner@faygenbarber.com'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'owner',
  is_active = true;
```

If the row already exists and you only need to fix the role, run:

```sql
update public.profiles
set role = 'owner', is_active = true
where email = 'owner@faygenbarber.com';
```

## 3) Make sure the environment is configured

Create a local env file at the project root named `.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4) Verify the login

1. Start the app:

```bash
npm run dev
```

2. Open:

```text
http://localhost:3000/admin/login
```

3. Sign in with the owner email and password you created in Supabase Auth.
4. After a successful sign-in you should be redirected to the admin area.
