import { createClient } from "@supabase/supabase-js";
import BusinessDirectory from "@/components/BusinessDirectory";
import type { DirectoryItem } from "@/lib/types";

// القايمة بتتغير كل ما نشاط جديد يسجل، فمش هنخزنها في الكاش
export const dynamic = "force-dynamic";

async function loadDirectory(): Promise<DirectoryItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("list_public_businesses");
    // لو الـ migration 002 لسه ما اتشغلتش الصفحة تفضل شغالة بقائمة فاضية بدل ما تقع
    return error ? [] : ((data ?? []) as DirectoryItem[]);
  } catch {
    return [];
  }
}

export default async function Home() {
  const items = await loadDirectory();
  return (
    <main className="mx-auto max-w-md p-5">
      <header className="py-6 text-center">
        <h1 className="text-4xl font-bold text-teal-700">قندور</h1>
        <p className="mt-2 text-slate-600">احجز دورك من موبايلك، وتابعه لحظياً من غير زحمة.</p>
      </header>

      <BusinessDirectory items={items} />

      <footer className="mt-10 border-t border-slate-200 pt-6 text-center">
        <p className="mb-3 text-sm text-slate-500">عندك عيادة أو صالون؟</p>
        <a href="/login" className="inline-block rounded-xl bg-teal-700 px-6 py-3 font-bold text-white">
          سجّل نشاطك مجاناً
        </a>
      </footer>
    </main>
  );
}
