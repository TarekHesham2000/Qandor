import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DisplayBoard from "@/components/DisplayBoard";
import type { BoardData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "شاشة العرض — دوري", robots: { index: false } };

export default async function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("ENV_MISSING");

  // أول عرض جاهز من السيرفر، وبعدها الشاشة بتتحدث لوحدها عبر Realtime
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("get_display_board", { p_slug: slug });
  if (error) throw new Error(error.message);
  if (!data) notFound();

  return <DisplayBoard slug={slug} initial={data as BoardData} />;
}
