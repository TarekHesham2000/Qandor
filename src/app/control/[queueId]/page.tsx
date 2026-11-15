import ControlPanel from "@/components/ControlPanel";

export const metadata = { title: "تحكم الطابور — راحتك", robots: { index: false } };

export default async function ControlPage({
  params,
  searchParams,
}: {
  params: Promise<{ queueId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { queueId } = await params;
  const { k } = await searchParams;
  return (
    <main className="mx-auto max-w-md p-4">
      <ControlPanel queueId={queueId} token={k ?? null} />
    </main>
  );
}
