import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * عميل Supabase بصلاحية anon فقط.
 * العميل (الزبون) مجهول: مفيش جلسة نحفظها، وكل التعامل عبر دوال RPC محدودة الصلاحيات،
 * فمفتاح anon العام آمن في المتصفح.
 */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("ENV_MISSING: ضبط NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  // نعيد استخدام نفس الـ client عشان قناة الـ Realtime تفضل على اتصال واحد
  browserClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return browserClient;
}
