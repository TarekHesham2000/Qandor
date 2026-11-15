"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Logo from "@/components/brand/Logo";
import SegDigits from "@/components/brand/SegDigits";
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
  // الرقم بيصغر كل ما الطوابير تزيد. العرض بالـ vw والارتفاع محسوب من المساحة المتاحة (الشاشة ناقص الهيدر والفوتر)
  // عشان الصفوف كلها تتحشر في شاشة التلفزيون من غير سكرول.
  const colsNum = n <= 2 ? Math.max(n, 1) : n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / colsNum));
  const vw = n <= 1 ? 30 : n === 2 ? 17 : n <= 4 ? 13 : 8;
  const size = `min(${vw}vw, calc((100dvh - 19rem) / ${rows} * 0.6))`;
  const maxNo = Math.max(0, ...board.queues.map((q) => q.serving_no ?? 0));
  const digits = Math.max(2, String(maxNo).length);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-ink p-4 text-white md:p-8">
      {!started && (
        <button
          onClick={start}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink/95 px-6 text-center"
        >
          <Logo size={44} light />
          <span className="font-display text-4xl font-black md:text-6xl">{board.name}</span>
          <span className="btn btn-led px-10 py-5 text-2xl">ابدأ الشاشة</span>
          <span className="text-sm text-white/55">اضغط مرة واحدة لتفعيل الصوت وملء الشاشة</span>
        </button>
      )}

      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black md:text-4xl">{board.name}</h1>
        <Logo size={28} light />
      </header>

      <section className={`grid min-h-0 flex-1 auto-rows-fr gap-4 ${cols}`}>
        {board.queues.map((q) => {
          const flashing = flashId === q.id;
          return (
            <div
              key={q.id}
              className={`flex flex-col items-center justify-center rounded-xl border p-4 text-led transition-colors duration-500 ${
                flashing ? "border-led bg-led/10" : "border-white/10 bg-black/30"
              } ${q.is_open ? "" : "opacity-45"}`}
            >
              <p className="font-display text-xl font-bold text-white md:text-3xl">{q.name}</p>
              <div className="py-3 leading-none" style={{ fontSize: size }}>
                <SegDigits value={q.serving_no} digits={digits} />
              </div>
              <p className="text-base text-white/65 md:text-2xl">
                {flashing ? "ينادي الآن" : !q.is_open ? "مقفول" : q.waiting_count > 0 ? `المنتظرين: ${q.waiting_count}` : "لا يوجد منتظرين"}
              </p>
            </div>
          );
        })}
      </section>

      <footer className="mt-4 flex items-end justify-between">
        <div className="flex items-center gap-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR للحجز" className="h-24 w-24 rounded-lg bg-white p-1.5 md:h-32 md:w-32" />
          )}
          <p className="max-w-[11rem] text-sm text-white/70 md:text-lg">امسح الكود واحجز دورك من موبايلك</p>
        </div>
        <div className="flex gap-2 text-xs opacity-40 hover:opacity-100">
          <button onClick={() => setSpeech((s) => !s)} className="rounded-lg bg-white/10 px-3 py-2">
            {speech ? "النطق شغال" : "النطق متوقف"}
          </button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-lg bg-white/10 px-3 py-2">
            ملء الشاشة
          </button>
        </div>
      </footer>
    </main>
  );
}
