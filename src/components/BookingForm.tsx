"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toArabicError } from "@/lib/errors";
import { COUNTRIES, DEFAULT_DIAL, buildPhone } from "@/lib/phone";
import type { PublicQueue } from "@/lib/types";

const KIND_LABEL = { clinic: "اختار الدكتور", barber: "اختار الحلاق", lab: "اختار القسم", other: "اختار الطابور" } as const;

export default function BookingForm({ queues, kind }: { queues: PublicQueue[]; kind: keyof typeof KIND_LABEL }) {
  const router = useRouter();
  const [queueId, setQueueId] = useState(queues.find((q) => q.is_open)?.id ?? "");
  const [name, setName] = useState("");
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState("");
  const [trap, setTrap] = useState(""); // honeypot: خانة مخفية، البشر ما بيملوهاش والبوتات بتملاها
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (trap) return; // بوت: نتجاهل بصمت من غير ما نكشف الفخ
    startTransition(async () => {
      try {
        const { data, error } = await getSupabase().rpc("take_ticket", {
          p_queue_id: queueId,
          p_name: name,
          p_phone: buildPhone(dial, phone),
        });
        if (error) throw error;
        // الـ token السري في الرابط هو "مفتاح" التذكرة بدل تسجيل الدخول
        router.push(`/t/${data.public_token}`);
      } catch (err) {
        setError(toArabicError(err));
      }
    });
  }

  if (queues.length === 0)
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-lg font-bold">مفيش طوابير متاحة دلوقتي</p>
        <p className="mt-1 text-ink/65">جرّب بعد شوية أو كلّم المحل.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-2.5">
        <legend className="mb-3 font-display text-lg font-bold">{KIND_LABEL[kind]}</legend>
        {queues.map((q) => {
          const selected = queueId === q.id;
          return (
            <label
              key={q.id}
              className={`card flex items-center justify-between gap-3 p-4 transition ${
                q.is_open ? "cursor-pointer" : "cursor-not-allowed opacity-55"
              } ${selected ? "!bg-brand-50 ring-2 ring-brand-600" : "hover:shadow-md"}`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio" name="queue" className="sr-only" value={q.id}
                  checked={selected} disabled={!q.is_open} onChange={() => setQueueId(q.id)}
                />
                <span
                  aria-hidden
                  className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? "border-brand-600" : "border-ink/25"}`}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
                <span className="font-display text-lg font-bold">{q.name}</span>
              </span>
              {!q.is_open ? (
                <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-medium text-ink/60">مقفول</span>
              ) : q.waiting_count === 0 ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">فاضي دلوقتي</span>
              ) : (
                <span className="text-sm text-ink/65">
                  <b className="text-ink">{q.waiting_count}</b> منتظر • حوالي {q.est_wait_minutes} د
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      <input
        tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)}
        name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">اسمك</span>
          <input
            required minLength={2} maxLength={50} value={name} onChange={(e) => setName(e.target.value)}
            autoComplete="name" className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">رقم الموبايل</span>
          <div dir="ltr" className="flex gap-2">
            <select
              value={dial} onChange={(e) => setDial(e.target.value)} aria-label="كود الدولة"
              className="input w-auto shrink-0"
            >
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.dial}>{c.name} {c.dial}</option>
              ))}
            </select>
            <input
              required type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx" autoComplete="tel" className="input min-w-0 flex-1 text-right"
            />
          </div>
        </label>
        <p className="text-sm text-ink/55">هنستخدم رقمك لتنبيهك بدورك بس. مش بيظهر لأي عميل تاني.</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={pending || !queueId} className="btn btn-primary w-full py-4 text-lg">
        {pending ? "جاري الحجز…" : "احجز دوري"}
      </button>
    </form>
  );
}
