"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getSupabase } from "@/lib/supabase";
import type { BoardData, QueueBroadcast } from "@/lib/types";

const POLL_MS = 15_000; // شبكة أمان لو اتصال الـ Realtime وقع
const FLASH_MS = 10_000;

export default function DisplayBoard({ initial, slug }: { initial: BoardData; slug: string }) {
  const [board, setBoard] = useState(initial);
  const [started, setStarted] = useState(false);
  const [speech, setSpeech] = useState(true);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [qr, setQr] = useState("");

  // refs: الـ callbacks بتتنادى من Realtime فمحتاجين آخر قيمة بدون إعادة الاشتراك
  const boardRef = useRef(board);
  const prevServing = useRef<Record<string, number | null>>(
    Object.fromEntries(initial.queues.map((q) => [q.id, q.serving_no]))
  );
  const audioRef = useRef<AudioContext | null>(null);
  const startedRef = useRef(false);
  const speechRef = useRef(true);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  boardRef.current = board;
  speechRef.current = speech;

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/b/${slug}`, { width: 320, margin: 1 }).then(setQr);
  }, [slug]);

  /** نغمة تنبيه + نطق الرقم. الصوت ما يشتغلش قبل ما المستخدم يضغط "ابدأ" (قيد المتصفحات). */
  const announce = useCallback((queueName: string, no: number) => {
    if (!startedRef.current) return;
    try {
      const ctx = audioRef.current;
      if (ctx) {
        [0, 0.28].forEach((t, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = i === 0 ? 660 : 880;
          g.gain.setValueAtTime(0.25, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + t);
          o.stop(ctx.currentTime + t + 0.45);
        });
      }
      if (speechRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`رقم ${no}، ${queueName}`);
        u.lang = "ar";
        u.rate = 0.9;
        setTimeout(() => window.speechSynthesis.speak(u), 600); // بعد النغمة
      }
    } catch {
      /* الصوت مش حرج: الشاشة بتفضل شغالة */
    }
  }, []);

  /** نقطة واحدة لكل التحديثات (بث لحظي أو polling): بتقارن وتنبه لو الرقم اتغير */
  const applyUpdate = useCallback(
    (id: string, serving: number | null, waiting: number) => {
      setBoard((b) => ({ ...b, queues: b.queues.map((q) => (q.id === id ? { ...q, serving_no: serving, waiting_count: waiting } : q)) }));
      const before = prevServing.current[id];
      prevServing.current[id] = serving;
      if (serving != null && serving !== before) {
        const q = boardRef.current.queues.find((x) => x.id === id);
        announce(q?.name ?? "", serving);
        setFlashId(id);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashId(null), FLASH_MS);
      }
    },
    [announce]
  );

  const queueIds = initial.queues.map((q) => q.id).join(",");

  useEffect(() => {
    const supabase = getSupabase();
    const channels = queueIds
      .split(",")
      .filter(Boolean)
      .map((id) =>
        supabase
          .channel(`queue:${id}`)
          .on("broadcast", { event: "queue_update" }, ({ payload }) => {
            const p = payload as QueueBroadcast;
            applyUpdate(id, p.serving_no, p.waiting_nos.length);
          })
          .subscribe()
      );

    const poll = setInterval(async () => {
      const { data } = await supabase.rpc("get_display_board", { p_slug: slug });
      const fresh = data as BoardData | null;
      if (!fresh) return;
      // لو اتضاف/اتحذف طابور نحدّث القايمة كلها، غير كده نحدّث الأرقام بس
      const same = fresh.queues.length === boardRef.current.queues.length && fresh.queues.every((q, i) => q.id === boardRef.current.queues[i]?.id);
      if (!same) {
        window.location.reload();
        return;
      }
      fresh.queues.forEach((q) => applyUpdate(q.id, q.serving_no, q.waiting_count));
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [queueIds, slug, applyUpdate]);

  // منع انطفاء الشاشة. الـ lock بيتفك لما التبويب يخفى فنطلبه تاني لما يرجع.
  useEffect(() => {
    if (!started) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try { lock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* مش كل الأجهزة بتدعمه */ }
    };
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, [started]);

  function start() {
    // لازم يتعمل جوه ضغطة المستخدم عشان المتصفح يسمح بالصوت وملء الشاشة
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioRef.current = new Ctx();
    audioRef.current.resume();
    startedRef.current = true;
    document.documentElement.requestFullscreen?.().catch(() => {});
    setStarted(true);
  }

  const n = board.queues.length;
  const cols = n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 md:grid-cols-2" : n <= 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
  // حجم الرقم بيصغر كل ما الطوابير تزيد عشان يفضل واضح من بعيد
  const numberSize = n <= 1 ? "text-[34vw]" : n <= 2 ? "text-[22vw] md:text-[18vw]" : "text-[16vw] md:text-[11vw]";

  return (
    <main className="relative flex min-h-dvh flex-col bg-slate-900 p-4 text-white md:p-8">
      {!started && (
        <button
          onClick={start}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900/95 text-center"
        >
          <span className="text-5xl font-black text-teal-400">{board.name}</span>
          <span className="rounded-2xl bg-teal-600 px-10 py-5 text-3xl font-bold">ابدأ الشاشة 🔊</span>
          <span className="text-sm text-slate-400">اضغط مرة واحدة لتفعيل الصوت وملء الشاشة</span>
        </button>
      )}

      <header className="mb-4 text-center">
        <h1 className="text-3xl font-black text-teal-400 md:text-5xl">{board.name}</h1>
      </header>

      <section className={`grid flex-1 gap-4 ${cols}`}>
        {board.queues.map((q) => {
          const flashing = flashId === q.id;
          return (
            <div
              key={q.id}
              className={`flex flex-col items-center justify-center rounded-3xl p-4 transition-colors ${
                flashing ? "animate-pulse bg-emerald-600" : "bg-slate-800"
              } ${q.is_open ? "" : "opacity-50"}`}
            >
              <p className="text-2xl font-bold md:text-4xl">{q.name}</p>
              <p className={`font-black leading-none tabular-nums ${numberSize}`}>{q.serving_no ?? "—"}</p>
              <p className="mt-2 text-lg text-slate-300 md:text-2xl">
                {!q.is_open ? "مقفول" : q.waiting_count > 0 ? `المنتظرين: ${q.waiting_count}` : "لا يوجد منتظرين"}
              </p>
            </div>
          );
        })}
      </section>

      <footer className="mt-4 flex items-end justify-between">
        <div className="flex items-center gap-3">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR للحجز" className="h-24 w-24 rounded-lg bg-white p-1 md:h-32 md:w-32" />
          )}
          <p className="max-w-[10rem] text-sm text-slate-300 md:text-lg">امسح الكود واحجز دورك من موبايلك</p>
        </div>
        <div className="flex gap-2 text-xs opacity-40 hover:opacity-100">
          <button onClick={() => setSpeech((s) => !s)} className="rounded-lg bg-slate-700 px-3 py-2">
            {speech ? "🔊 النطق شغال" : "🔇 النطق متوقف"}
          </button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-lg bg-slate-700 px-3 py-2">
            ملء الشاشة
          </button>
        </div>
      </footer>
    </main>
  );
}
