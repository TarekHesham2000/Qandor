"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Logo from "@/components/brand/Logo";
import SegDigits from "@/components/brand/SegDigits";
import TicketCard, { type TicketPhase } from "@/components/ticket/TicketCard";
import { whoFor } from "@/lib/who";
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

  const shell = (children: React.ReactNode) => (
    <div className="space-y-6">
      <div className="flex justify-center"><Logo size={26} /></div>
      {children}
    </div>
  );

  if (state === "loading")
    return shell(<div className="mx-auto h-[26rem] max-w-sm animate-pulse rounded-3xl bg-ink/10" aria-label="جاري التحميل" />);
  if (state === "notfound")
    return shell(
      <div className="card mx-auto max-w-sm p-6 text-center">
        <p className="font-display text-xl font-bold">التذكرة دي مش موجودة</p>
        <p className="mt-2 text-ink/65">اتأكد إن الرابط كامل، أو احجز دور جديد من الرابط اللي عند المحل.</p>
      </div>
    );
  if (state === "error" || !ticket)
    return shell(
      <div className="card mx-auto max-w-sm p-6 text-center">
        <p className="font-display text-xl font-bold">مش قادرين نوصل للسيرفر</p>
        <p className="mt-2 text-ink/65">اتأكد من النت وجرّب تاني.</p>
        <button onClick={refetch} className="btn btn-primary mt-4">حاول تاني</button>
      </div>
    );

  const waiting = ticket.status === "waiting";
  const phase: TicketPhase = waiting ? (ticket.people_ahead <= 2 ? "soon" : "waiting") : ticket.status;

  return shell(
    <div className="mx-auto max-w-sm space-y-5">
      <TicketCard
        phase={phase}
        ticketNo={ticket.ticket_no}
        ahead={ticket.people_ahead}
        estMinutes={ticket.est_wait_minutes}
        place={`${ticket.business_name} • ${ticket.queue_name}`}
        customerName={ticket.customer_name}
      />

      {waiting && (
        <div className="flex items-center justify-between rounded-xl bg-ink px-5 py-3 text-led">
          <span className="text-sm text-white/65">{ticket.kind ? `الحالي عند ${whoFor(ticket.kind)}` : "الحالي دلوقتي"}</span>
          <span className="text-4xl"><SegDigits value={ticket.serving_no} digits={2} /></span>
        </div>
      )}

      {waiting && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-ink/55">الصفحة بتتحدث لوحدها. سيبها مفتوحة وهنطلّع صوت واهتزاز لما دورك يجي.</p>
          <button onClick={cancel} className="text-sm font-medium text-red-600 underline underline-offset-4">إلغاء دوري</button>
        </div>
      )}
    </div>
  );
}
