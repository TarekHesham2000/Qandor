-- =====================================================================
-- Migration 003: حماية الحجز من الإساءة
-- طبقات الحماية (كلها داخل take_ticket عشان محدش يتخطاها بالـ API مباشرة):
--  1) سقف أقصى للمنتظرين في الطابور (يحدده صاحب النشاط)
--  2) حد أقصى لتذاكر نفس الرقم في اليوم (يمنع حجز/إلغاء متكرر)
--  3) Rate limit لكل IP على الطابور (يمنع السكربتات)
-- =====================================================================

alter table public.queues
  add column if not exists max_waiting smallint not null default 60
  check (max_waiting between 1 and 500);

-- بنخزّن hash للـ IP مش الـ IP نفسه: كافي للعد ومش بيكشف عنوان حد لو القاعدة اتسربت
alter table public.tickets add column if not exists client_ip_hash text;
create index if not exists tickets_ip_idx on public.tickets (client_ip_hash, created_at)
  where client_ip_hash is not null;

-- PostgREST بيحط هيدرز الطلب في الإعداد request.headers
create or replace function public._client_ip_hash()
returns text language plpgsql stable set search_path = public as $$
declare h json; ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  ip := btrim(coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)));
  if ip = '' then return null; end if;
  return md5(ip);
end $$;

revoke execute on function public._client_ip_hash() from public, anon, authenticated;

create or replace function public.take_ticket(p_queue_id uuid, p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_q queues%rowtype; v_b businesses%rowtype; v_day date;
  v_phone text; v_name text; v_exist tickets%rowtype; v_no int; v_token text;
  v_waiting int; v_phone_today int; v_ip text; v_ip10 int; v_ip60 int;
begin
  select * into v_q from queues where id = p_queue_id;
  if not found then raise exception 'queue_not_found'; end if;
  select * into v_b from businesses where id = v_q.business_id;
  if not v_b.is_active or not v_q.is_open then raise exception 'queue_closed'; end if;

  -- تنظيف الاسم من أي رموز تحكم
  v_name  := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'));
  v_phone := _normalize_phone(p_phone);
  if char_length(v_name) < 2 or char_length(v_name) > 50 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;

  v_day := (now() at time zone v_b.timezone)::date;

  -- نفس الرقم وعنده تذكرة نشطة: نرجّعها (بيعالج الضغط المزدوج) قبل أي فحص حدود
  select * into v_exist from tickets
   where queue_id = p_queue_id and queue_day = v_day
     and customer_phone = v_phone and status in ('waiting','serving') limit 1;
  if found then
    return jsonb_build_object('public_token', v_exist.public_token,
                              'ticket_no', v_exist.ticket_no, 'already_exists', true);
  end if;

  -- 1) سقف الطابور
  select count(*)::int into v_waiting from tickets
   where queue_id = p_queue_id and queue_day = v_day and status = 'waiting';
  if v_waiting >= v_q.max_waiting then raise exception 'queue_full'; end if;

  -- 2) حد يومي لكل رقم (أي حالة، فالإلغاء والحجز من جديد بيتحسب)
  select count(*)::int into v_phone_today from tickets
   where queue_id = p_queue_id and queue_day = v_day and customer_phone = v_phone;
  if v_phone_today >= 4 then raise exception 'phone_limit'; end if;

  -- 3) Rate limit لكل IP: 15 تذكرة/10 دقايق و 40/ساعة على نفس الطابور.
  -- الأرقام سخية عمداً لأن شبكات الموبايل المصرية بتشارك IP بين ناس كتير (CGNAT).
  v_ip := _client_ip_hash();
  if v_ip is not null then
    select count(*) filter (where created_at > now() - interval '10 minutes')::int, count(*)::int
      into v_ip10, v_ip60
      from tickets
     where client_ip_hash = v_ip and queue_id = p_queue_id
       and created_at > now() - interval '1 hour';
    if v_ip10 >= 15 or v_ip60 >= 40 then raise exception 'too_many_requests'; end if;
  end if;

  insert into queue_counters (queue_id, queue_day, last_no) values (p_queue_id, v_day, 1)
  on conflict (queue_id, queue_day) do update set last_no = queue_counters.last_no + 1
  returning last_no into v_no;

  insert into tickets (queue_id, business_id, queue_day, ticket_no, customer_name, customer_phone, client_ip_hash)
  values (p_queue_id, v_q.business_id, v_day, v_no, v_name, v_phone, v_ip)
  returning public_token into v_token;

  perform _broadcast_queue(p_queue_id);
  return jsonb_build_object('public_token', v_token, 'ticket_no', v_no, 'already_exists', false);
end $$;

grant execute on function public.take_ticket(uuid, text, text) to anon, authenticated;
