"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toArabicError } from "@/lib/errors";
import type { PublicQueue } from "@/lib/types";

const KIND_LABEL = { clinic: "اختار الدكتور", barber: "اختار الحلاق", lab: "اختار القسم", other: "اختار الطابور" } as const;

export default function BookingForm({ queues, kind }: { queues: PublicQueue[]; kind: keyof typeof KIND_LABEL }) {
  const router = useRouter();
  const [queueId, setQueueId] = useState(queues.find((q) => q.is_open)?.id ?? "");
  const [name, setName] = useState("");
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
          p_phone: phone,
        });
        if (error) throw error;
        // الـ token السري في الرابط هو "مفتاح" التذكرة بدل تسجيل الدخول
        router.push(`/t/${data.public_token}`);
      } catch (err) {
        setError(toArabicError(err));
      }
    });
  }

  if (queues.length === 0) return <p className="text-center text-slate-500">لسه مفيش طوابير متاحة هنا.</p>;

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">{KIND_LABEL[kind]}</legend>
        {queues.map((q) => (
          <label
            key={q.id}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              queueId === q.id ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600" : "border-slate-200 bg-white"
            } ${q.is_open ? "" : "cursor-not-allowed opacity-50"}`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="queue"
                className="accent-teal-600"
                value={q.id}
                checked={queueId === q.id}
                disabled={!q.is_open}
                onChange={() => setQueueId(q.id)}
              />
              <span className="font-medium">{q.name}</span>
            </span>
            <span className="text-sm text-slate-500">
              {q.is_open
                ? q.waiting_count === 0
                  ? "فاضي دلوقتي"
                  : `${q.waiting_count} منتظر • حوالي ${q.est_wait_minutes} د`
                : "مقفول"}
            </span>
          </label>
        ))}
      </fieldset>

      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        name="website"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="space-y-3">
        <input
          required
          minLength={2}
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسمك"
          autoComplete="name"
          className="w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:ring-2 focus:ring-teal-600"
        />
        <input
          required
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="رقم الموبايل 01xxxxxxxxx"
          autoComplete="tel"
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
        />
        <p className="text-xs text-slate-400">هنبعتلك تنبيه لما دورك يقرب. رقمك مش بيظهر لأي عميل تاني.</p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending || !queueId}
        className="w-full rounded-xl bg-teal-700 p-4 text-lg font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"
      >
        {pending ? "جاري الحجز…" : "احجز دوري"}
      </button>
    </form>
  );
}
