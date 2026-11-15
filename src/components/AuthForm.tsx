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
        className="input text-right"
      />
      <input
        required type="password" dir="ltr" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="الباسوورد" autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="input text-right"
      />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}
      <button disabled={busy} className="btn btn-primary w-full">
        {busy ? "..." : mode === "login" ? "دخول" : "إنشاء حساب"}
      </button>
      {mode === "login" && (
        <a href="/forgot-password" className="block text-center text-sm text-ink/55 underline underline-offset-4">نسيت الباسوورد؟</a>
      )}
      <button
        type="button"
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
        className="w-full text-sm font-medium text-brand-700 underline underline-offset-4"
      >
        {mode === "login" ? "معنديش حساب — إنشاء حساب جديد" : "عندي حساب — تسجيل دخول"}
      </button>
    </form>
  );
}
