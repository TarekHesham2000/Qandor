"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { getOwnerSupabase } from "@/lib/supabase-owner";
import type { Business, QueueRow } from "@/lib/types";

const KIND_LABEL: Record<Business["kind"], string> = { barber: "حلاق / صالون", clinic: "عيادة", lab: "معمل", other: "أخرى" };
const WHO_LABEL: Record<Business["kind"], string> = { barber: "حلاق", clinic: "دكتور", lab: "قسم", other: "طابور" };

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    alert("تم النسخ ✅");
  } catch {
    prompt("انسخ الرابط:", text);
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [current, setCurrent] = useState<Business | null>(null);
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [qr, setQr] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const loadBusinesses = useCallback(async () => {
    const supabase = getOwnerSupabase();
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return router.replace("/login");
    // الـ RLS بترجّع أنشطة المستخدم الحالي فقط، فمفيش فلتر owner_id هنا
    const { data, error } = await supabase.from("businesses").select("id,name,slug,kind,is_active,is_listed").order("created_at");
    if (error) setError(error.message);
    const list = (data ?? []) as Business[];
    setBusinesses(list);
    setCurrent((prev) => list.find((b) => b.id === prev?.id) ?? list[0] ?? null);
    setLoading(false);
  }, [router]);

  const loadQueues = useCallback(async (businessId: string) => {
    const { data, error } = await getOwnerSupabase()
      .from("queues")
      .select("id,business_id,name,is_open,avg_service_minutes,control_token")
      .eq("business_id", businessId)
      .order("sort_order")
      .order("created_at");
    if (error) setError(error.message);
    setQueues((data ?? []) as QueueRow[]);
  }, []);

  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

  useEffect(() => {
    if (!current) return;
    loadQueues(current.id);
    QRCode.toDataURL(`${window.location.origin}/b/${current.slug}`, { width: 512, margin: 2 }).then(setQr);
  }, [current, loadQueues]);

  async function logout() {
    await getOwnerSupabase().auth.signOut();
    router.replace("/login");
  }

  if (loading) return <p className="mt-20 text-center text-slate-500">جاري التحميل…</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-700">لوحة التحكم</h1>
        <button onClick={logout} className="text-sm text-slate-500 underline">خروج</button>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!current ? (
        <CreateBusiness onCreated={loadBusinesses} />
      ) : (
        <>
          {businesses.length > 1 && (
            <select
              value={current.id}
              onChange={(e) => setCurrent(businesses.find((b) => b.id === e.target.value) ?? null)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3"
            >
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">{current.name}</h2>
            <p className="text-sm text-slate-500">{KIND_LABEL[current.kind]}</p>
            <div className="mt-4 flex flex-col items-center gap-3">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR للحجز" className="h-48 w-48" />
              )}
              <p dir="ltr" className="break-all text-center text-sm text-slate-600">{origin}/b/{current.slug}</p>
              <div className="flex gap-2">
                <button onClick={() => copy(`${origin}/b/${current.slug}`)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">نسخ رابط الحجز</button>
                {qr && <a href={qr} download={`${current.slug}-qr.png`} className="rounded-lg border border-teal-700 px-4 py-2 text-sm text-teal-700">تحميل الـ QR</a>}
              </div>
              <p className="text-xs text-slate-400">اطبع الـ QR وعلّقه في المحل، والعميل يمسحه ويحجز.</p>
            </div>
          </section>

          <label className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
            <span>
              <span className="block font-medium">يظهر في الصفحة الرئيسية</span>
              <span className="text-xs text-slate-500">لو قفلته، الناس تحجز بالرابط أو الـ QR بس.</span>
            </span>
            <input
              type="checkbox"
              checked={current.is_listed}
              onChange={async (e) => {
                await getOwnerSupabase().from("businesses").update({ is_listed: e.target.checked }).eq("id", current.id);
                loadBusinesses();
              }}
              className="h-5 w-5 accent-teal-600"
            />
          </label>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">{WHO_LABEL[current.kind]}ين / الطوابير</h2>
            {queues.map((q) => (
              <QueueCard key={q.id} q={q} origin={origin} onChanged={() => loadQueues(current.id)} />
            ))}
            <AddQueue businessId={current.id} label={WHO_LABEL[current.kind]} onAdded={() => loadQueues(current.id)} />
          </section>
        </>
      )}
    </div>
  );
}

function CreateBusiness({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<Business["kind"]>("barber");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // owner_id بيتحط تلقائياً من الـ DB (default auth.uid())
    const { error } = await getOwnerSupabase().from("businesses").insert({ name, slug: slug.toLowerCase(), kind });
    setBusy(false);
    if (error) return setError(error.code === "23505" ? "الرابط ده مستخدم، اختار اسم تاني." : "تأكد إن الرابط حروف إنجليزي وأرقام وشرطة فقط (3 حروف على الأقل).");
    onCreated();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">سجّل نشاطك</h2>
      <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المحل أو العيادة" className="w-full rounded-xl border border-slate-200 p-3" />
      <input required dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="الرابط بالإنجليزي مثال: prince-salon" className="w-full rounded-xl border border-slate-200 p-3 text-right" />
      <select value={kind} onChange={(e) => setKind(e.target.value as Business["kind"])} className="w-full rounded-xl border border-slate-200 p-3">
        {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">إنشاء</button>
    </form>
  );
}

function AddQueue({ businessId, label, onAdded }: { businessId: string; label: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await getOwnerSupabase().from("queues").insert({ business_id: businessId, name: name.trim() });
    setBusy(false);
    setName("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`اسم ${label} جديد`} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3" />
      <button disabled={busy} className="rounded-xl bg-teal-700 px-5 font-bold text-white disabled:opacity-50">إضافة</button>
    </form>
  );
}

function QueueCard({ q, origin, onChanged }: { q: QueueRow; origin: string; onChanged: () => void }) {
  // لينك التحكم: الحلاق يفتحه على موبايله من غير حساب. التوكن هو المفتاح، فالرابط سري.
  const controlUrl = `${origin}/control/${q.id}?k=${q.control_token}`;

  async function toggle() {
    await getOwnerSupabase().from("queues").update({ is_open: !q.is_open }).eq("id", q.id);
    onChanged();
  }
  async function rename() {
    const name = prompt("الاسم الجديد:", q.name)?.trim();
    if (!name || name === q.name) return;
    await getOwnerSupabase().from("queues").update({ name }).eq("id", q.id);
    onChanged();
  }
  async function remove() {
    if (!confirm(`حذف "${q.name}" وكل تذاكره؟`)) return;
    await getOwnerSupabase().from("queues").delete().eq("id", q.id);
    onChanged();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">{q.name}</p>
          <p className="text-xs text-slate-500">متوسط الخدمة {Math.round(q.avg_service_minutes)} دقيقة</p>
        </div>
        <button onClick={toggle} className={`rounded-full px-3 py-1 text-sm ${q.is_open ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
          {q.is_open ? "مفتوح" : "مقفول"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a href={controlUrl} className="rounded-lg bg-teal-700 px-3 py-2 text-white">فتح صفحة التحكم</a>
        <button onClick={() => copy(controlUrl)} className="rounded-lg border border-teal-700 px-3 py-2 text-teal-700">نسخ لينك الحلاق</button>
        <button onClick={rename} className="px-3 py-2 text-slate-600">تعديل الاسم</button>
        <button onClick={remove} className="px-3 py-2 text-red-600">حذف</button>
      </div>
    </div>
  );
}
