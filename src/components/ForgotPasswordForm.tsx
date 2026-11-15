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
        <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          لو الإيميل ده مسجل عندنا، هتوصلك رسالة فيها رابط تعيين الباسوورد. راجع الـ Spam كمان.
        </p>
        <a href="/login" className="text-sm font-medium text-brand-700 underline underline-offset-4">رجوع لتسجيل الدخول</a>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="الإيميل" autoComplete="email"
        className="input text-right"
      />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="btn btn-primary w-full">
        {busy ? "..." : "ابعتلي الرابط"}
      </button>
      <a href="/login" className="block text-center text-sm text-ink/55 underline underline-offset-4">رجوع</a>
    </form>
  );
}
