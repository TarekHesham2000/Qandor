"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOwnerSupabase } from "@/lib/supabase-owner";

export default function ResetPasswordForm() {
  const router = useRouter();
  // checking: بنستنى supabase-js يقرأ التوكن من رابط الإيميل ويفتح جلسة استرجاع
  const [phase, setPhase] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getOwnerSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) setPhase("ready");
    });
    // لو الجلسة اتفتحت قبل ما نشترك في الأحداث، أو الرابط منتهي
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setPhase((p) => (p === "checking" ? (data.session ? "ready" : "invalid") : p));
    }, 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("الباسوورد قصير (6 حروف على الأقل).");
    if (password !== confirm) return setError("الباسوورد وتأكيده مش متطابقين.");
    setBusy(true);
    const { error } = await getOwnerSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(/same/i.test(error.message) ? "اختار باسوورد مختلف عن القديم." : "حصلت مشكلة. اطلب رابط جديد.");
    setPhase("done");
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  if (phase === "checking") return <p className="text-center text-slate-500">جاري التحقق من الرابط…</p>;
  if (phase === "invalid")
    return (
      <div className="space-y-3 text-center">
        <p className="rounded-lg bg-red-50 p-4 text-red-700">الرابط منتهي أو غير صالح.</p>
        <a href="/forgot-password" className="text-sm text-teal-700 underline">اطلب رابط جديد</a>
      </div>
    );
  if (phase === "done") return <p className="rounded-lg bg-emerald-50 p-4 text-center text-emerald-800">تم تغيير الباسوورد ✅</p>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required type="password" dir="ltr" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="الباسوورد الجديد" autoComplete="new-password"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
      />
      <input
        required type="password" dir="ltr" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
        placeholder="تأكيد الباسوورد" autoComplete="new-password"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right outline-none focus:ring-2 focus:ring-teal-600"
      />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-teal-700 p-3 font-bold text-white disabled:opacity-50">
        {busy ? "..." : "حفظ الباسوورد"}
      </button>
    </form>
  );
}
