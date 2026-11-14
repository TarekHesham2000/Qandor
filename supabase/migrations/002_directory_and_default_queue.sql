-- =====================================================================
-- Migration 002: دليل الأنشطة في الصفحة الرئيسية + طابور افتراضي تلقائي
-- =====================================================================

-- صاحب النشاط يقدر يخفي نشاطه من الصفحة الرئيسية (الرابط والـ QR يفضلوا شغالين)
alter table public.businesses add column if not exists is_listed boolean not null default true;

-- كل نشاط جديد يتعمله طابور افتراضي، فالرابط يشتغل فوراً بدون إعداد
create or replace function public._create_default_queue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into queues (business_id, name)
  values (new.id, case new.kind
                    when 'clinic' then 'الكشف'
                    when 'barber' then 'الحلاقة'
                    when 'lab'    then 'التحاليل'
                    else 'الطابور' end);
  return new;
end $$;

drop trigger if exists businesses_default_queue on public.businesses;
create trigger businesses_default_queue
  after insert on public.businesses
  for each row execute function public._create_default_queue();

revoke execute on function public._create_default_queue() from public, anon, authenticated;

-- الأنشطة القديمة اللي ما عندهاش أي طابور (زي اللي اتعمل قبل التحديث ده)
insert into public.queues (business_id, name)
select b.id, case b.kind when 'clinic' then 'الكشف' when 'barber' then 'الحلاقة'
                         when 'lab' then 'التحاليل' else 'الطابور' end
from public.businesses b
where not exists (select 1 from public.queues q where q.business_id = b.id);

-- قايمة الأنشطة العامة: بيانات عامة فقط (الاسم/الرابط/النوع)، وبس اللي ليها طابور مفتوح.
-- حد أقصى 200 عشان الصفحة الرئيسية تفضل خفيفة.
create or replace function public.list_public_businesses()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'name', b.name, 'slug', b.slug, 'kind', b.kind, 'queues_count', c.cnt) as x
    from businesses b
    cross join lateral (
      select count(*)::int as cnt from queues q where q.business_id = b.id and q.is_open
    ) c
    where b.is_active and b.is_listed and c.cnt > 0
    order by b.created_at desc
    limit 200
  ) s
$$;

grant execute on function public.list_public_businesses() to anon, authenticated;
