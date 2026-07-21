# FAYGEN BARBER

אתר תדמית ומערכת תורים מלאה, בעברית ובכיוון RTL, מוכן ל־GitHub ול־Vercel.

## הפעלה מקומית

1. שכפלו את `.env.example` לקובץ בשם `.env.local`.
2. התקינו: `npm install`
3. הפעילו: `npm run dev`
4. פתחו `http://localhost:3000`.

## חיבור Supabase

1. צרו פרויקט חדש ב־Supabase.
2. במסך SQL Editor הדביקו והריצו את `supabase/migrations/001_initial_schema.sql`.
3. ב־Project Settings > API העתיקו URL, anon key ו־service_role key אל `.env.local`.
4. ב־Authentication > Users צרו משתמש מנהל.
5. ב־SQL Editor הריצו (עם פרטי המשתמש שיצרתם):
   `insert into public.profiles(id,email,full_name,role) select id,email,'מנהל','admin' from auth.users where email='YOUR_EMAIL';`
6. כניסת מנהל: `/admin/login`.

אין לחשוף או להעלות ל־Git את `SUPABASE_SERVICE_ROLE_KEY`. הקובץ `.env.local` כבר מוחרג.

## העלאה ל־GitHub ול־Vercel

צרו מאגר GitHub, העלו אליו את כל הפרויקט, ואז ב־Vercel בחרו Import Project. הוסיפו ב־Vercel > Settings > Environment Variables את ארבעת המשתנים שב־`.env.example`. לאחר הפרסום עדכנו `NEXT_PUBLIC_SITE_URL` לכתובת האתר ובצעו Deploy מחדש.

## בדיקה לפני פרסום

הריצו `npm run build`. ודאו שקביעת תור נשמרת, ששעה תפוסה נחסמת, שהכניסה למנהל עובדת וששינויים בשירותים מופיעים בבסיס הנתונים.
