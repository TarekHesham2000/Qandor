"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOwnerSupabase } from "@/lib/supabase-owner";
import { toArabicError } from "@/lib/errors";
import type { ControlState } from "@/lib/types";

const POLL_MS = 15_000;

export default function ControlPanel({ queueId, token }: { queueId: string; token: string | null }) {
  const [state, setState] = useState<ControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [wName, setWName] = useState("");
  const [wPhone, setWPhone] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  // قفل محلي ضد الضغط المزدوج (السيرفر كمان بيقفل الصف، دي طبقة إضافية للتجربة)
  const lock = useRef(false);

  const refresh = useCallback(async () => {
    const { data, error } = await getOwnerSupabase().rpc("get_queue_for_control", { p_queue_id: queueId, p_token: token });
    if (error) {
      setError(error.message.includes("forbidden") ? "الرابط ده غير صالح أو منتهي." : "مش قادرين نوصل للسيرفر.");
      return;
    }
    setError(null);
    setState(data as ControlState);
  }, [queueId, token]);

  useEffect(() => {
    refresh();
    const supabase = getOwnerSupabase();
    // نسمع نفس قناة البث اللي العملاء بيسمعوها: لو حد حجز أو لغى، الشاشة تتحدث فوراً
    const channel = supabase.channel(`queue:${queueId}`).on("broadcast", { event: "queue_update" }, () => refresh()).subscribe();
    const poll = setInterval(refresh, POLL_MS);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [queueId, refresh]);

  async function act(fn: "queue_next" | "queue_skip") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const { error } = await getOwnerSupabase().rpc(fn, { p_queue_id: queueId, p_control_token: token });
    if (error) setError("فشلت العملية. جرّب تاني.");
    await refresh();
    lock.current = false;
    setBusy(false);
  }

  async function addWalkin(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setAddMsg(null);
    // الاسم والموبايل اختياريين: العميل الحضوري ممكن يكون من غير موبايل
    const { data, error } = await getOwnerSupabase().rpc("queue_add_walkin", {
      p_queue_id: queueId,
      p_name: wName,
      p_phone: wPhone,
      p_control_token: token,
    });
    if (error) {
      setAddMsg(toArabicError(error));
    } else {
      setAddMsg(data.already_exists ? `الرقم ده موجود بالفعل برقم ${data.ticket_no}` : `تمت الإضافة ✅ رقمه ${data.ticket_no}`);
      setWName("");
      setWPhone("");
      await refresh();
    }
    lock.current = false;
    setBusy(false);
  }

  async function cancelTicket(id: string, name: string) {
    if (!confirm(`إلغاء تذكرة ${name}؟`)) return;
    await getOwnerSupabase().rpc("queue_cancel_ticket", { p_ticket_id: id, p_control_token: token });
    refresh();
  }

  if (error && !state) return <p className="mt-20 text-center text-red-600">{error}</p>;
  if (!state) return <p className="mt-20 text-center text-slate-500">جاري التحميل…</p>;

  const { serving, waiting, queue } = state;
  const hasNext = waiting.length > 0;

  return (
    <div className="space-y-4">
      <header className="text-center">
        <h1 className="text-xl font-bold text-teal-800">{queue.name}</h1>
        <p className="text-xs text-slate-500">منتظرين: {waiting.length} • متوسط الخدمة {Math.round(queue.avg_minutes)} د</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>}

      <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">الحالي</p>
        {serving ? (
          <>
            <p className="text-7xl font-black tabular-nums text-emerald-600">{serving.ticket_no}</p>
            <p className="mt-1 text-lg font-semibold">{serving.name}</p>
            {serving.phone ? (
              <a dir="ltr" href={`tel:${serving.phone}`} className="text-sm text-teal-700 underline">{serving.phone}</a>
            ) : (
              <p className="text-xs text-slate-400">حضوري</p>
            )}
          </>
        ) : (
          <p className="my-6 text-xl text-slate-400">مفيش حد دلوقتي</p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => act("queue_next")}
          disabled={busy || (!serving && !hasNext)}
          className="col-span-2 rounded-2xl bg-teal-700 p-5 text-xl font-bold text-white active:scale-95 disabled:opacity-40"
        >
          {serving ? (hasNext ? "خلصت ← التالي" : "خلصت") : "نادي التالي"}
        </button>
        <button
          onClick={() => act("queue_skip")}
          disabled={busy || !serving}
          className="rounded-2xl bg-amber-500 p-5 font-bold text-white active:scale-95 disabled:opacity-40"
        >
          تخطي
        </button>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <button
          onClick={() => { setShowAdd((v) => !v); setAddMsg(null); }}
          className="w-full text-center font-bold text-teal-700"
        >
          {showAdd ? "إخفاء" : "+ إضافة عميل (جه من غير موبايل)"}
        </button>
        {showAdd && (
          <form onSubmit={addWalkin} className="mt-3 space-y-2">
            <input
              value={wName} onChange={(e) => setWName(e.target.value)} maxLength={50}
              placeholder="الاسم (اختياري)"
              className="w-full rounded-xl border border-slate-200 p-3"
            />
            <input
              type="tel" inputMode="tel" dir="ltr" value={wPhone} onChange={(e) => setWPhone(e.target.value)}
              placeholder="الموبايل (اختياري — للتنبيه)"
              className="w-full rounded-xl border border-slate-200 p-3 text-right"
            />
            <button disabled={busy} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">
              أضف للطابور
            </button>
            {addMsg && <p role="status" className="rounded-lg bg-slate-100 p-2 text-center text-sm">{addMsg}</p>}
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">المنتظرين</h2>
        {waiting.length === 0 && <p className="text-sm text-slate-400">مفيش منتظرين.</p>}
        {waiting.map((t, i) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-10 text-center text-2xl font-black tabular-nums text-teal-700">{t.ticket_no}</span>
              <div>
                <p className="font-medium">{t.name}</p>
                {t.phone ? (
                  <p dir="ltr" className="text-right text-xs text-slate-400">{t.phone}</p>
                ) : (
                  <p className="text-xs text-slate-400">حضوري</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {i === 0 && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">الجاي</span>}
              <button onClick={() => cancelTicket(t.id, t.name)} className="text-sm text-red-600">إلغاء</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
