"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOwnerSupabase } from "@/lib/supabase-owner";
import SegDigits from "@/components/brand/SegDigits";
import { toArabicError } from "@/lib/errors";
import { COUNTRIES, DEFAULT_DIAL, buildPhone } from "@/lib/phone";
import type { ControlState } from "@/lib/types";

const POLL_MS = 15_000;

export default function ControlPanel({ queueId, token }: { queueId: string; token: string | null }) {
  const [state, setState] = useState<ControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [wName, setWName] = useState("");
  const [wDial, setWDial] = useState(DEFAULT_DIAL);
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
      p_phone: buildPhone(wDial, wPhone),
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

  if (error && !state)
    return (
      <div className="card mt-16 p-6 text-center">
        <p className="font-display text-xl font-bold">{error}</p>
        <p className="mt-2 text-ink/65">اطلب من صاحب المحل يبعتلك اللينك تاني.</p>
      </div>
    );
  if (!state) return <p className="mt-20 text-center text-ink/55">جاري التحميل…</p>;

  const { serving, waiting, queue } = state;
  const hasNext = waiting.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-black">{queue.name}</h1>
        <p className="text-sm text-ink/55">متوسط الخدمة {Math.round(queue.avg_minutes)} د</p>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>}

      {/* الحالي: بنفس شكل شاشة الصالة عشان الحلاق يشوف اللي العميل بيشوفه */}
      <section className="rounded-xl bg-ink p-5 text-center text-white shadow-[0_14px_30px_-12px_rgba(14,23,38,0.5)]">
        <p className="text-sm text-white/55">الحالي</p>
        <div className="py-2 text-8xl text-led"><SegDigits value={serving?.ticket_no ?? null} digits={2} /></div>
        {serving ? (
          <>
            <p className="font-display text-xl font-bold">{serving.name}</p>
            {serving.phone ? (
              <a dir="ltr" href={`tel:${serving.phone}`} className="text-sm text-white/65 underline underline-offset-4">{serving.phone}</a>
            ) : (
              <p className="text-sm text-white/50">حضوري</p>
            )}
          </>
        ) : (
          <p className="text-white/55">مفيش حد دلوقتي</p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => act("queue_next")}
          disabled={busy || (!serving && !hasNext)}
          className="btn btn-primary col-span-2 py-5 text-xl"
        >
          {serving ? (hasNext ? "خلصت ← التالي" : "خلصت") : "نادي التالي"}
        </button>
        <button onClick={() => act("queue_skip")} disabled={busy || !serving} className="btn btn-led py-5 text-lg">
          تخطي
        </button>
      </div>

      <section className="card p-4">
        <button
          onClick={() => { setShowAdd((v) => !v); setAddMsg(null); }}
          className="w-full text-center font-semibold text-brand-700"
        >
          {showAdd ? "إخفاء" : "+ إضافة عميل (جه من غير موبايل)"}
        </button>
        {showAdd && (
          <form onSubmit={addWalkin} className="mt-3 space-y-2">
            <input value={wName} onChange={(e) => setWName(e.target.value)} maxLength={50} placeholder="الاسم (اختياري)" className="input" />
            <div dir="ltr" className="flex gap-2">
              <select
                value={wDial} onChange={(e) => setWDial(e.target.value)} aria-label="كود الدولة"
                className="input w-auto shrink-0"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.dial}>{c.name} {c.dial}</option>
                ))}
              </select>
              <input
                type="tel" inputMode="tel" dir="ltr" value={wPhone} onChange={(e) => setWPhone(e.target.value)}
                placeholder="الموبايل (اختياري، للتنبيه)" className="input min-w-0 flex-1 text-right"
              />
            </div>
            <button disabled={busy} className="btn btn-ink w-full">أضف للطابور</button>
            {addMsg && <p role="status" className="rounded-xl bg-paper p-2 text-center text-sm">{addMsg}</p>}
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-baseline justify-between font-display text-lg font-bold">
          المنتظرين <span className="text-sm font-medium text-ink/55">{waiting.length}</span>
        </h2>
        {waiting.length === 0 && <p className="text-sm text-ink/50">مفيش منتظرين.</p>}
        {waiting.map((t, i) => (
          <div key={t.id} className="card flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <span className="w-11 text-center font-display text-2xl font-black tabular-nums text-brand-700">{t.ticket_no}</span>
              <div>
                <p className="font-semibold">{t.name}</p>
                {t.phone ? (
                  <p dir="ltr" className="text-right text-xs text-ink/45">{t.phone}</p>
                ) : (
                  <p className="text-xs text-ink/45">حضوري</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {i === 0 && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">الجاي</span>}
              <button onClick={() => cancelTicket(t.id, t.name)} className="text-sm font-medium text-red-600">إلغاء</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
