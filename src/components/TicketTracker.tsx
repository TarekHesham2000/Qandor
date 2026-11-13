"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { QueueBroadcast, TicketStatus } from "@/lib/types";

// شبكة أمان: لو اتصال الـ Realtime وقع (موبايل/نت ضعيف) نسحب الحالة كل 20 ثانية
const FALLBACK_POLL_MS = 20_000;

/** صوت + اهتزاز لما يجي الدور. Web Audio عشان منحتاجش ملف صوت. */
function alertUser() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600]);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.2;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {
    /* المتصفح ممكن يمنع الصوت قبل أي تفاعل — مش مشكلة */
  }
}

export default function TicketTracker({ token }: { token: string }) {
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const lastStatus = useRef<string | null>(null);

  const apply = useCallback((t: TicketStatus) => {
    if (t.status === "serving" && lastStatus.current !== "serving") alertUser();
    lastStatus.current = t.status;
    setTicket(t);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const { data, error } = await getSupabase().rpc("get_ticket_status", { p_token: token });
      if (error) throw error;
      if (!data) return setState("notfound");
      apply(data as TicketStatus);
      setState("ready");
    } catch {
      setState((s) => (s === "ready" ? s : "error"));
    }
  }, [token, apply]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const queueId = ticket?.queue_id;
  const myNo = ticket?.ticket_no;

  useEffect(() => {
    if (!queueId || myNo == null) return;
    const supabase = getSupabase();

    // الحمولة أرقام فقط، فنحسب ترتيبنا محلياً بدون أي طلب إضافي لكل تحديث
    const channel = supabase
      .channel(`queue:${queueId}`)
      .on("broadcast", { event: "queue_update" }, ({ payload }) => {
        const p = payload as QueueBroadcast;
        setTicket((prev) => {
          if (!prev) return prev;
          if (p.serving_no === prev.ticket_no) {
            if (lastStatus.current !== "serving") alertUser();
            lastStatus.current = "serving";
            return { ...prev, status: "serving", people_ahead: 0, est_wait_minutes: 0, serving_no: p.serving_no };
          }
          if (p.waiting_nos.includes(prev.ticket_no)) {
            const ahead = p.waiting_nos.filter((n) => n < prev.ticket_no).length + (p.serving_no != null ? 1 : 0);
            return {
              ...prev,
              status: "waiting",
              serving_no: p.serving_no,
              people_ahead: ahead,
              avg_minutes: p.avg_minutes,
              est_wait_minutes: Math.ceil(ahead * p.avg_minutes),
            };
          }
          return prev; // خلّصت/اتلغت/اتخطت — هنجيب الحالة النهائية من السيرفر
        });
        if (p.serving_no !== myNo && !p.waiting_nos.includes(myNo)) refetch();
      })
      .subscribe();

    const poll = setInterval(refetch, FALLBACK_POLL_MS);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [queueId, myNo, refetch]);

  async function cancel() {
    if (!confirm("متأكد إنك عايز تلغي دورك؟")) return;
    await getSupabase().rpc("cancel_ticket", { p_token: token });
    refetch();
  }

  if (state === "loading") return <p className="mt-20 text-center text-slate-500">جاري التحميل…</p>;
  if (state === "notfound") return <p className="mt-20 text-center text-slate-500">التذكرة دي مش موجودة.</p>;
  if (state === "error" || !ticket)
    return (
      <div className="mt-20 text-center">
        <p className="text-slate-500">مش قادرين نوصل للسيرفر.</p>
        <button onClick={refetch} className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-white">حاول تاني</button>
      </div>
    );

  const done = ticket.status === "done";
  const skipped = ticket.status === "skipped";
  const cancelled = ticket.status === "cancelled";
  const serving = ticket.status === "serving";
  const waiting = ticket.status === "waiting";

  return (
    <div className="space-y-5 text-center">
      <header>
        <p className="text-sm text-slate-500">{ticket.business_name} • {ticket.queue_name}</p>
        <p className="mt-1 text-slate-600">أهلاً {ticket.customer_name}</p>
      </header>

      <section
        className={`rounded-3xl p-8 shadow-sm ${
          serving ? "animate-pulse bg-emerald-600 text-white" : "bg-white"
        }`}
        aria-live="polite"
      >
        <p className={serving ? "text-emerald-50" : "text-slate-500"}>رقم تذكرتك</p>
        <p className="text-8xl font-black tabular-nums">{ticket.ticket_no}</p>
        {serving && <p className="mt-2 text-2xl font-bold">دورك دلوقتي! ادخل 🎉</p>}
        {done && <p className="mt-2 text-lg text-slate-600">تمت الخدمة. شكراً لك ✅</p>}
        {skipped && <p className="mt-2 text-lg text-amber-700">اتخطّى دورك لأنك ما حضرتش. احجز تاني لو لسه محتاج.</p>}
        {cancelled && <p className="mt-2 text-lg text-slate-600">تم إلغاء التذكرة.</p>}
      </section>

      {waiting && (
        <section className="grid grid-cols-3 gap-3">
          <Stat label="الحالي" value={ticket.serving_no ?? "—"} />
          <Stat label="قدامك" value={ticket.people_ahead} />
          <Stat label="الوقت التقريبي" value={`${ticket.est_wait_minutes} د`} />
        </section>
      )}

      {waiting && (
        <>
          <p className="text-xs text-slate-400">الصفحة بتتحدث لوحدها. سيبها مفتوحة وهنطلّع صوت واهتزاز لما دورك يجي.</p>
          <button onClick={cancel} className="text-sm text-red-600 underline">إلغاء دوري</button>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-2xl font-bold tabular-nums text-teal-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
