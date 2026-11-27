import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import BookingForm from "@/components/BookingForm";
import Logo from "@/components/brand/Logo";
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
  return { title: b ? `احجز دورك — ${b.name}` : "دوري" };
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  if (!business) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pb-12 pt-6">
      <a href="/" aria-label="الصفحة الرئيسية"><Logo size={24} /></a>
      <header className="mb-8 mt-8">
        <p className="text-ink/60">احجز دورك في</p>
        <h1 className="mt-1 text-4xl font-black leading-tight">{business.name}</h1>
      </header>
      <BookingForm queues={business.queues} kind={business.kind} />
    </main>
  );
}
