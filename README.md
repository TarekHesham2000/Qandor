# راحتك (Rahtak)

منصة طوابير وحجز رقمي للعيادات والحلاقين: العميل بيتابع دوره لحظياً من موبايله بدون تطبيق ولا حساب.

**Stack:** Next.js (App Router) · Tailwind · Supabase (Postgres + RLS + Realtime Broadcast)

## التشغيل
1. شغّل `supabase/migrations/001_init.sql` في Supabase → SQL Editor.
2. انسخ `.env.example` إلى `.env.local` وحط `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` (من Project Settings → API).
3. `npm install && npm run dev`

## الصفحات
- `/b/<slug>` اختيار الحلاق/الدكتور والحجز (العميل بدون حساب)
- `/t/<token>` التتبع الحي للتذكرة

## قيد قادم
لوحة صاحب النشاط، صفحة تحكم الحلاق، شاشة العرض، إرسال التنبيهات (واتساب/SMS).
