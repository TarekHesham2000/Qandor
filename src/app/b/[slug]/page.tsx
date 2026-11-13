import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import BookingForm from "@/components/BookingForm";
import type { PublicBusiness } from "@/lib/types";

// الأرقام لحظية (عدد المنتظرين)، فمش هنخزّن الصفحة في الكاش
export const dynamic = "force-dynamic";

async function loadBusiness(slug: string): Promise<PublicBusiness | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("ENV_MISSING");
  // Server Component: الـ HTML يوصل جاهز بأسماء الحلاقين → أسرع أول عرض و SEO أفضل
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("get_public_business", { p_slug: slug });
  if (error) throw new Error(error.message);
  return data as PublicBusiness | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await loadBusiness(slug).catch(() => null);
  return { title: b ? `احجز دورك — ${b.name}` : "قندور" };
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  if (!business) notFound();

  return (
    <main className="mx-auto max-w-md p-5">
      <header className="mb-6 text-center">
        <p className="text-sm text-slate-500">احجز دورك في</p>
        <h1 className="text-2xl font-bold text-teal-800">{business.name}</h1>
      </header>
      <BookingForm queues={business.queues} kind={business.kind} />
    </main>
  );
}
