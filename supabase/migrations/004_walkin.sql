-- =====================================================================
-- Migration 004: إضافة عميل حضوري (Walk-in) من صفحة التحكم
-- العميل الحضوري ممكن يكون من غير اسم أو موبايل، فنخفف القيود على الجدول
-- ونتأكد إن كل مكان بيبعت تنبيهات بيتجاهل التذاكر اللي ملهاش موبايل.
-- =====================================================================

alter table public.tickets alter column customer_phone drop not null;
alter table public.tickets drop constraint if exists tickets_customer_phone_check;
alter table public.tickets add constraint tickets_customer_phone_check
  check (customer_phone is null or customer_phone ~ '^\+[0-9]{8,15}$');

-- online = حجز العميل بنفسه | walkin = أضافه الحلاق/الموظف (مفيد للإحصائيات لاحقاً)
alter table public.tickets add column if not exists source text not null default 'online'
  check (source in ('online','walkin'));

-- التنبيهات: تجاهل التذاكر بدون موبايل (بس نعلّمها notified عشان ما تتعالجش تاني)
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
         'أهلاً ' || customer_name || '، دورك قرب في ' || v_bname || ' — فاضل ' || (ahead + 1)
           || ' قدامك (شامل اللي بيتخدم دلوقتي). جهّز نفسك.'
  from due
  where customer_phone is not null;
end $$;

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
    if v_next.customer_phone is not null then
      select b.name into v_bname from businesses b where b.id = v_next.business_id;
      insert into notifications_outbox (ticket_id, business_id, kind, phone, message)
      values (v_next.id, v_next.business_id, 'your_turn', v_next.customer_phone,
              'يا ' || v_next.customer_name || '، دورك دلوقتي في ' || v_bname || ' 🎉');
    end if;
  end if;

  perform _enqueue_almost_turn(p_queue_id, v_day);
  perform _broadcast_queue(p_queue_id);

  return jsonb_build_object(
    'serving', case when v_next.id is null then null
                    else jsonb_build_object('ticket_no', v_next.ticket_no, 'name', v_next.customer_name) end
  );
end $$;

-- صفحة التحكم: بنرجّع source عشان نميّز الحضوري، والموبايل ممكن يكون null
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
                                          'phone', customer_phone, 'source', source, 'started_at', started_at)
                from tickets where queue_id = q.id and queue_day = v_day and status = 'serving' limit 1),
    'waiting', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ticket_no', ticket_no,
                                          'name', customer_name, 'phone', customer_phone, 'source', source)
                                          order by ticket_no)
                from tickets where queue_id = q.id and queue_day = v_day and status = 'waiting'), '[]'::jsonb)
  );
end $$;

-- إضافة عميل حضوري. الاسم والموبايل اختياريين.
-- مقصود: بتتخطى is_open وسقف max_waiting وحدود الـ IP، لأن اللي بيضيف هو صاحب
-- النشاط/موظفه وبيشوف العميل قدامه (حتى لو الحجز أونلاين مقفول).
create or replace function public.queue_add_walkin(
  p_queue_id uuid, p_name text default null, p_phone text default null, p_control_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_q queues%rowtype; v_day date; v_name text; v_phone text; v_no int; v_exist tickets%rowtype;
begin
  if not _can_control(p_queue_id, p_control_token) then raise exception 'forbidden'; end if;
  select * into v_q from queues where id = p_queue_id;
  v_day := _today(p_queue_id);

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'));
  if char_length(v_name) > 50 then raise exception 'invalid_name'; end if;

  v_phone := null;
  if btrim(coalesce(p_phone, '')) <> '' then
    v_phone := _normalize_phone(p_phone);
    if v_phone is null then raise exception 'invalid_phone'; end if;
    -- نفس الرقم عنده تذكرة نشطة: ما نكرّرش
    select * into v_exist from tickets
     where queue_id = p_queue_id and queue_day = v_day
       and customer_phone = v_phone and status in ('waiting','serving') limit 1;
    if found then
      return jsonb_build_object('ticket_no', v_exist.ticket_no, 'already_exists', true);
    end if;
  end if;

  insert into queue_counters (queue_id, queue_day, last_no) values (p_queue_id, v_day, 1)
  on conflict (queue_id, queue_day) do update set last_no = queue_counters.last_no + 1
  returning last_no into v_no;

  -- من غير اسم: "زبون 7" يطابق قيد طول الاسم ويتعرف بسهولة في القايمة
  if char_length(v_name) < 2 then v_name := 'زبون ' || v_no; end if;

  insert into tickets (queue_id, business_id, queue_day, ticket_no, customer_name, customer_phone, source)
  values (p_queue_id, v_q.business_id, v_day, v_no, v_name, v_phone, 'walkin');

  perform _broadcast_queue(p_queue_id);
  return jsonb_build_object('ticket_no', v_no, 'name', v_name, 'already_exists', false);
end $$;

grant execute on function public.queue_add_walkin(uuid, text, text, text) to anon, authenticated;
