-- =====================================================================
-- Migration 005: شاشة العرض العامة
-- بترجّع أرقام فقط (الرقم الحالي وعدد المنتظرين) بدون أي اسم أو موبايل،
-- لأن الشاشة معروضة في صالة عامة.
-- =====================================================================
create or replace function public.get_display_board(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b businesses%rowtype; v_day date;
begin
  select * into b from businesses where slug = lower(p_slug) and is_active;
  if not found then return null; end if;
  v_day := (now() at time zone b.timezone)::date;

  return jsonb_build_object(
    'name', b.name, 'kind', b.kind,
    'queues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'name', q.name, 'is_open', q.is_open,
        'serving_no', (select t.ticket_no from tickets t
                        where t.queue_id = q.id and t.queue_day = v_day and t.status = 'serving' limit 1),
        'waiting_count', (select count(*)::int from tickets t
                        where t.queue_id = q.id and t.queue_day = v_day and t.status = 'waiting')
      ) order by q.sort_order, q.created_at)
      from queues q where q.business_id = b.id
    ), '[]'::jsonb)
  );
end $$;

grant execute on function public.get_display_board(text) to anon, authenticated;
