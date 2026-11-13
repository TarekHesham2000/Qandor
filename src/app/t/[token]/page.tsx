import TicketTracker from "@/components/TicketTracker";

export const metadata = { title: "دورك — تتبع مباشر", robots: { index: false } };

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-md p-5">
      <TicketTracker token={token} />
    </main>
  );
}
