import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * عميل Supabase لصاحب النشاط (والموظف): بيحتفظ بالجلسة في المتصفح.
 * منفصل عن عميل العميل المجهول عشان جلسة المالك ما تتسربش لصفحات الزبائن.
 * لو مفيش جلسة بيشتغل بصلاحية anon عادي، فصفحة الموظف (لينك التحكم) بتستخدمه برضو.
 */
export function getOwnerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("ENV_MISSING");
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "qandor-owner-auth" },
  });
  return client;
}
