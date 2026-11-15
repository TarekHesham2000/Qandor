"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOwnerSupabase } from "@/lib/supabase-owner";

function arabicAuthError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "الإيميل أو الباسوورد غلط.";
  if (msg.includes("already registered")) return "الإيميل ده مسجل قبل كده. سجّل دخول.";
  if (msg.includes("at least")) return "الباسوورد قصير (6 حروف على الأقل).";
  if (msg.includes("Email not confirmed")) return "لازم تأكد الإيميل الأول من الرسالة اللي وصلتك.";
  return "حصلت مشكلة. جرّب تاني.";
}

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = getOwnerSupabase();
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(arabicAuthError(error.message));
    // لو تأكيد الإيميل مفعّل في Supabase مش هتيجي جلسة بعد التسجيل
    if (!data.session) return setInfo("اتبعتلك رسالة تأكيد على الإيميل. أكّده وبعدين سجّل دخول.");
    router.push("/dashboard");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="الإيميل" autoComplete="email"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
      />
      <input
        required type="password" dir="ltr" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="الباسوورد" autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
      />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">
        {busy ? "..." : mode === "login" ? "دخول" : "إنشاء حساب"}
      </button>
      {mode === "login" && (
        <a href="/forgot-password" className="block text-center text-sm text-slate-500 underline">نسيت الباسوورد؟</a>
      )}
      <button
        type="button"
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
        className="w-full text-sm text-teal-700 underline"
      >
        {mode === "login" ? "معنديش حساب — إنشاء حساب جديد" : "عندي حساب — تسجيل دخول"}
      </button>
    </form>
  );
}
