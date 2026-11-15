"use client";

import { useState } from "react";
import { getOwnerSupabase } from "@/lib/supabase-owner";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getOwnerSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Supabase بيرجّع نجاح حتى لو الإيميل مش مسجل (عشان محدش يكتشف مين مسجل)، فبنعرض نفس الرسالة دايماً
    if (error && /rate limit/i.test(error.message)) return setError("طلبات كتير. استنى شوية وجرّب تاني.");
    if (error) return setError("حصلت مشكلة. جرّب تاني.");
    setSent(true);
  }

  if (sent)
    return (
      <div className="space-y-3 text-center">
        <p className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
          لو الإيميل ده مسجل عندنا، هتوصلك رسالة فيها رابط تعيين الباسوورد. راجع الـ Spam كمان.
        </p>
        <a href="/login" className="text-sm text-teal-700 underline">رجوع لتسجيل الدخول</a>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="الإيميل" autoComplete="email"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
      />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">
        {busy ? "..." : "ابعتلي الرابط"}
      </button>
      <a href="/login" className="block text-center text-sm text-slate-500 underline">رجوع</a>
    </form>
  );
}
