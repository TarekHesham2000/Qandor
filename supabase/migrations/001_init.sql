-- =====================================================================
-- دورك (Dorak) — Smart Queue SaaS
-- Migration 001: الجداول + RLS + دوال الطابور
--
-- فلسفة التصميم:
--  * صاحب النشاط فقط عنده حساب (Supabase Auth). العميل مجهول تماماً.
--  * العميل لا يلمس الجداول أبداً: كل تعامله عبر دوال RPC (security definer)
--    بتعرض الحد الأدنى من البيانات. ده يخلي الـ RLS بسيطة وآمنة.
--  * الـ Realtime عبر Broadcast (قناة لكل طابور) بدل postgres_changes:
--    أرخص، ما بيكشفش بيانات شخصية، وما بيحتاجش RLS على الـ realtime.
--  * الحلاق/الدكتور ممكن يتحكم بالطابور عبر "لينك تحكم" (control_token)
--    بدون حساب، أو صاحب النشاط من لوحته.
-- =====================================================================

-- ---------- 1) الجداول ------------------------------------------------

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  -- default auth.uid(): الواجهة ما تحتاجش تبعت owner_id، والـ RLS تتحقق منه
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  -- slug هو الرابط العام: dorak.app/b/<slug>
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  kind        text not null default 'other' check (kind in ('clinic','barber','lab','other')),
  phone       text,
  -- اليوم بيتحدد بتوقيت النشاط عشان الترقيم يبدأ من 1 كل صباح محلي
  timezone    text not null default 'Africa/Cairo',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses(owner_id);

-- طابور لكل حلاق / دكتور / عيادة
create table public.queues (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 60),
  is_open              boolean not null default true,
  -- متوسط وقت الخدمة: بيتحدث تلقائياً (متوسط متحرك) كل ما حد يخلص
  avg_service_minutes  numeric(5,2) not null default 10 check (avg_service_minutes between 1 and 120),
  -- ابعت تنبيه "دورك قرب" لما يفضل قدامه العدد ده
  notify_when_ahead    smallint not null default 2 check (notify_when_ahead between 0 and 10),
  -- لينك تحكم للحلاق/الدكتور بدون حساب (سري، ممكن يتجدد)
  control_token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);
create index queues_business_idx on public.queues(business_id, sort_order);

create table public.tickets (
  id              uuid primary key default gen_random_uuid(),
  queue_id        uuid not null references public.queues(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  queue_day       date not null,
  ticket_no       int  not null,
  customer_name   text not null check (char_length(customer_name) between 2 and 50),
  customer_phone  text not null check (customer_phone ~ '^\+[0-9]{8,15}$'),
  status          text not null default 'waiting'
                  check (status in ('waiting','serving','done','skipped','cancelled')),
  -- token سري في لينك العميل: هو "مفتاح" التذكرة بدل تسجيل الدخول
  public_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  notified_at     timestamptz,
  unique (queue_id, queue_day, ticket_no)
);
-- Partial index: الاستعلامات الساخنة دايماً على الحالات النشطة فقط
create index tickets_active_idx on public.tickets(queue_id, queue_day, ticket_no)
  where status in ('waiting','serving');
create index tickets_phone_idx on public.tickets(queue_id, queue_day, customer_phone);
create index tickets_business_idx on public.tickets(business_id, created_at desc);

-- عداد الترقيم اليومي: صف واحد لكل (طابور، يوم). بيتحدث بـ upsert ذري
-- فمستحيل تتكرر الأرقام حتى لو 100 عميل حجزوا في نفس اللحظة.
create table public.queue_counters (
  queue_id  uuid not null references public.queues(id) on delete cascade,
  queue_day date not null,
  last_no   int  not null default 0,
  primary key (queue_id, queue_day)
);

-- صندوق صادر التنبيهات: الدوال بتكتب فيه، وعامل خارجي (Edge Function)
-- بيبعت واتساب/SMS ويعلّم الحالة. ده بيفصل منطق الطابور عن مزود الرسائل.
create table public.notifications_outbox (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind        text not null check (kind in ('almost_your_turn','your_turn')),
  phone       text not null,
  message     text not null,
  status      text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index outbox_pending_idx on public.notifications_outbox(id) where status = 'pending';

-- ---------- 2) RLS ----------------------------------------------------
-- العميل (anon) ما عندوش أي policy = ما يقدرش يقرأ/يكتب أي جدول مباشرة.

alter table public.businesses            enable row level security;
alter table public.queues                enable row level security;
alter table public.tickets               enable row level security;
alter table public.queue_counters        enable row level security;  -- بدون policies: الدوال فقط
alter table public.notifications_outbox  enable row level security;

create policy businesses_owner_all on public.businesses
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy queues_owner_all on public.queues
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- التذاكر: المالك يقرأ فقط (التعديل عبر الدوال عشان الـ broadcast والإحصائيات)
create policy tickets_owner_select on public.tickets
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy outbox_owner_select on public.notifications_outbox
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- ---------- 3) دوال داخلية (مش متاحة للعميل) --------------------------

create or replace function public._normalize_phone(p text)
returns text language plpgsql immutable as $$
declare d text;
begin
  -- نحوّل الأرقام العربية-الهندية لأرقام لاتينية ونشيل أي رموز
  d := translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789');
  d := regexp_replace(d, '[^0-9+]', '', 'g');
  if d ~ '^01[0125][0-9]{8}$'          then return '+2' || d;            -- موبايل مصري محلي
  elsif d ~ '^\+?201[0125][0-9]{8}$'   then return '+' || ltrim(d, '+');  -- مصري دولي
  elsif d ~ '^\+[0-9]{8,15}$'          then return d;                     -- أي رقم دولي
  end if;
  return null;
end $$;

create or replace function public._today(p_queue_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone b.timezone)::date
  from queues q join businesses b on b.id = q.business_id
  where q.id = p_queue_id
$$;

-- هل المستدعي يقدر يتحكم بالطابور؟ (صاحب النشاط، أو حامل لينك التحكم)
create or replace function public._can_control(p_queue_id uuid, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from queues q join businesses b on b.id = q.business_id
    where q.id = p_queue_id
      and (b.owner_id = auth.uid() or (p_token is not null and q.control_token = p_token))
  )
$$;

-- بث حالة الطابور للمشتركين. الحمولة أرقام فقط (بدون أسماء/موبايلات) فالقناة
-- العامة آمنة، والعميل يحسب ترتيبه محلياً بدون أي استعلام إضافي.
create or replace function public._broadcast_queue(p_queue_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_day date; v_payload jsonb;
begin
  v_day := _today(p_queue_id);
  select jsonb_build_object(
    'serving_no', (select ticket_no from tickets
                   where queue_id = p_queue_id and queue_day = v_day and status = 'serving' limit 1),
    'waiting_nos', coalesce((select jsonb_agg(ticket_no order by ticket_no) from tickets
                   where queue_id = p_queue_id and queue_day = v_day and status = 'waiting'), '[]'::jsonb),
    'avg_minutes', (select avg_service_minutes from queues where id = p_queue_id)
  ) into v_payload;
  perform realtime.send(v_payload, 'queue_update', 'queue:' || p_queue_id::text, false);
exception when others then
  -- فشل البث ما لازم يكسر حجز أو زر "التالي"
  null;
end $$;

-- إنهاء تذكرة + تحديث متوسط وقت الخدمة (متوسط متحرك أسي: 80% قديم / 20% جديد)
-- ليه EMA؟ بيتكيف مع سرعة الحلاق الفعلية من غير ما نخزّن تاريخ كبير.
create or replace function public._finish_ticket(p_ticket_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare t tickets%rowtype; v_minutes numeric;
begin
  update tickets set status = p_status, finished_at = now()
  where id = p_ticket_id returning * into t;
  if p_status = 'done' and t.started_at is not null then
    v_minutes := extract(epoch from (now() - t.started_at)) / 60.0;
    -- نتجاهل القيم الشاذة (ضغطة بالغلط أو نسيان الزر)
    if v_minutes between 1 and 90 then
      update queues
         set avg_service_minutes = least(120, greatest(1, round((0.8 * avg_service_minutes + 0.2 * v_minutes)::numeric, 2)))
       where id = t.queue_id;
    end if;
  end if;
end $$;

-- تنبيه "دورك قرب": لكل تذكرة منتظرة داخل نافذة التنبيه ولم تُنبَّه بعد
create or replace function public._enqueue_almost_turn(p_queue_id uuid, p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare v_window smallint; v_bname text;
begin
  select q.notify_when_ahead, b.name into v_window, v_bname
  from queues q join businesses b on b.id = q.business_id where q.id = p_queue_id;

  with ranked as (
    select id, business_id, customer_phone, customer_name,
           row_number() over (order by ticket_no) - 1 as ahead
    from tickets
    where queue_id = p_queue_id and queue_day = p_day and status = 'waiting'
  ), due as (
    update tickets t set notified_at = now()
    from ranked r
    where t.id = r.id and r.ahead <= v_window and t.notified_at is null
    returning t.id, r.business_id, r.customer_phone, r.customer_name, r.ahead
  )
  insert into notifications_outbox (ticket_id, business_id, kind, phone, message)
  select id, business_id, 'almost_your_turn', customer_phone,
         'أهلاً ' || customer_name || '، دورك قرب في ' || v_bname || ' — فاضل ' || (ahead + 1) || ' قدامك (شامل اللي بيتخدم دلوقتي). جهّز نفسك.'
  from due;
end $$;

-- المحرك الأساسي: ينهي الحالي (done/skipped) وينادي التالي.
-- قفل صف الطابور (FOR UPDATE) بيمنع الضغط المزدوج أو ضغطتين من جهازين من إنهم
-- ينادوا نفس العميل مرتين.
create or replace function public._advance(p_queue_id uuid, p_final_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_day date; v_cur tickets%rowtype; v_next tickets%rowtype; v_bname text;
begin
  perform 1 from queues where id = p_queue_id for update;
  v_day := _today(p_queue_id);

  select * into v_cur from tickets
   where queue_id = p_queue_id and queue_day = v_day and status = 'serving';
  if found then perform _finish_ticket(v_cur.id, p_final_status); end if;

  select * into v_next from tickets
   where queue_id = p_queue_id and queue_day = v_day and status = 'waiting'
   order by ticket_no limit 1;
  if found then
    update tickets set status = 'serving', started_at = now() where id = v_next.id;
    select b.name into v_bname from businesses b where b.id = v_next.business_id;
    insert into notifications_outbox (ticket_id, business_id, kind, phone, message)
    values (v_next.id, v_next.business_id, 'your_turn', v_next.customer_phone,
            'يا ' || v_next.customer_name || '، دورك دلوقتي في ' || v_bname || ' 🎉');
  end if;

  perform _enqueue_almost_turn(p_queue_id, v_day);
  perform _broadcast_queue(p_queue_id);

  return jsonb_build_object(
    'serving', case when v_next.id is null then null
                    else jsonb_build_object('ticket_no', v_next.ticket_no, 'name', v_next.customer_name) end
  );
end $$;

-- ---------- 4) دوال العميل (anon) -------------------------------------

-- صفحة النشاط العامة: الاسم + الحلاقين/الأطباء + عدد المنتظرين لكل واحد
create or replace function public.get_public_business(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b businesses%rowtype;
begin
  select * into b from businesses where slug = lower(p_slug) and is_active;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', b.name, 'kind', b.kind,
    'queues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'name', q.name, 'is_open', q.is_open,
        'waiting_count', w.cnt,
        'est_wait_minutes', ceil(w.cnt * q.avg_service_minutes)
      ) order by q.sort_order, q.created_at)
      from queues q
      cross join lateral (
        select count(*)::int as cnt from tickets t
        where t.queue_id = q.id
          and t.queue_day = (now() at time zone b.timezone)::date
          and t.status in ('waiting','serving')
      ) w
      where q.business_id = b.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.take_ticket(p_queue_id uuid, p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_q queues%rowtype; v_b businesses%rowtype; v_day date;
  v_phone text; v_name text; v_exist tickets%rowtype; v_no int; v_token text;
begin
  select * into v_q from queues where id = p_queue_id;
  if not found then raise exception 'queue_not_found'; end if;
  select * into v_b from businesses where id = v_q.business_id;
  if not v_b.is_active or not v_q.is_open then raise exception 'queue_closed'; end if;

  v_name  := btrim(coalesce(p_name, ''));
  v_phone := _normalize_phone(p_phone);
  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;

  v_day := (now() at time zone v_b.timezone)::date;

  -- تذكرة نشطة واحدة لكل رقم في الطابور: بيمنع الإساءة وبيرجّع نفس التذكرة لو العميل ضغط مرتين
  select * into v_exist from tickets
   where queue_id = p_queue_id and queue_day = v_day
     and customer_phone = v_phone and status in ('waiting','serving') limit 1;
  if found then
    return jsonb_build_object('public_token', v_exist.public_token,
                              'ticket_no', v_exist.ticket_no, 'already_exists', true);
  end if;

  -- ترقيم ذري (upsert على العداد)
  insert into queue_counters (queue_id, queue_day, last_no) values (p_queue_id, v_day, 1)
  on conflict (queue_id, queue_day) do update set last_no = queue_counters.last_no + 1
  returning last_no into v_no;

  insert into tickets (queue_id, business_id, queue_day, ticket_no, customer_name, customer_phone)
  values (p_queue_id, v_q.business_id, v_day, v_no, v_name, v_phone)
  returning public_token into v_token;

  perform _broadcast_queue(p_queue_id);
  return jsonb_build_object('public_token', v_token, 'ticket_no', v_no, 'already_exists', false);
end $$;

-- صفحة التتبع الحي: العميل بيعرف "فاضل قدامي كام واحد" والوقت التقديري
create or replace function public.get_ticket_status(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t tickets%rowtype; q queues%rowtype; b businesses%rowtype;
  v_serving int; v_ahead int := 0;
begin
  select * into t from tickets where public_token = p_token;
  if not found then return null; end if;
  select * into q from queues where id = t.queue_id;
  select * into b from businesses where id = q.business_id;

  select ticket_no into v_serving from tickets
   where queue_id = t.queue_id and queue_day = t.queue_day and status = 'serving' limit 1;

  if t.status = 'waiting' then
    select count(*)::int into v_ahead from tickets
     where queue_id = t.queue_id and queue_day = t.queue_day
       and status = 'waiting' and ticket_no < t.ticket_no;
    -- اللي بيتخدم دلوقتي قدامه برضو
    if v_serving is not null then v_ahead := v_ahead + 1; end if;
  end if;

  return jsonb_build_object(
    'ticket_no', t.ticket_no, 'status', t.status, 'customer_name', t.customer_name,
    'queue_id', q.id, 'queue_name', q.name, 'business_name', b.name,
    'serving_no', v_serving, 'people_ahead', v_ahead,
    'avg_minutes', q.avg_service_minutes,
    'est_wait_minutes', ceil(v_ahead * q.avg_service_minutes)
  );
end $$;

create or replace function public.cancel_ticket(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare t tickets%rowtype;
begin
  update tickets set status = 'cancelled', finished_at = now()
   where public_token = p_token and status = 'waiting'
  returning * into t;
  if not found then return false; end if;
  perform _broadcast_queue(t.queue_id);
  return true;
end $$;

-- ---------- 5) دوال التحكم (المالك أو لينك الحلاق/الدكتور) ------------

create or replace function public.get_queue_for_control(p_queue_id uuid, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q queues%rowtype; v_day date;
begin
  if not _can_control(p_queue_id, p_token) then raise exception 'forbidden'; end if;
  select * into q from queues where id = p_queue_id;
  v_day := _today(p_queue_id);
  return jsonb_build_object(
    'queue', jsonb_build_object('id', q.id, 'name', q.name, 'is_open', q.is_open,
                                'avg_minutes', q.avg_service_minutes),
    'serving', (select jsonb_build_object('id', id, 'ticket_no', ticket_no, 'name', customer_name,
                                          'phone', customer_phone, 'started_at', started_at)
                from tickets where queue_id = q.id and queue_day = v_day and status = 'serving' limit 1),
    'waiting', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ticket_no', ticket_no,
                                          'name', customer_name, 'phone', customer_phone) order by ticket_no)
                from tickets where queue_id = q.id and queue_day = v_day and status = 'waiting'), '[]'::jsonb)
  );
end $$;

-- "التالي": يخلّص الحالي ويدخّل اللي بعده
create or replace function public.queue_next(p_queue_id uuid, p_control_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_control(p_queue_id, p_control_token) then raise exception 'forbidden'; end if;
  return _advance(p_queue_id, 'done');
end $$;

-- "تخطي": الحالي ما حضرش (ما بيدخلش في حساب متوسط الوقت) وينادي اللي بعده
create or replace function public.queue_skip(p_queue_id uuid, p_control_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _can_control(p_queue_id, p_control_token) then raise exception 'forbidden'; end if;
  return _advance(p_queue_id, 'skipped');
end $$;

-- إلغاء تذكرة منتظرة من جهة النشاط
create or replace function public.queue_cancel_ticket(p_ticket_id uuid, p_control_token text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare t tickets%rowtype;
begin
  select * into t from tickets where id = p_ticket_id;
  if not found or not _can_control(t.queue_id, p_control_token) then raise exception 'forbidden'; end if;
  update tickets set status = 'cancelled', finished_at = now()
   where id = p_ticket_id and status = 'waiting';
  perform _broadcast_queue(t.queue_id);
  return found;
end $$;

-- ---------- 6) الصلاحيات ----------------------------------------------
-- Supabase بيدي anon/authenticated EXECUTE تلقائياً على دوال public، فنسحبها
-- من الدوال الداخلية صراحةً ونفتح فقط اللي المفروض يتنادى من الواجهة.
revoke execute on function
  public._normalize_phone(text), public._today(uuid), public._can_control(uuid, text),
  public._broadcast_queue(uuid), public._finish_ticket(uuid, text),
  public._enqueue_almost_turn(uuid, date), public._advance(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.get_public_business(text), public.take_ticket(uuid, text, text),
  public.get_ticket_status(text), public.cancel_ticket(text),
  public.get_queue_for_control(uuid, text), public.queue_next(uuid, text),
  public.queue_skip(uuid, text), public.queue_cancel_ticket(uuid, text)
to anon, authenticated;
