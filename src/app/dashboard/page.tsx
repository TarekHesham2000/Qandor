import Dashboard from "@/components/Dashboard";

export const metadata = { title: "لوحة التحكم — قندور", robots: { index: false } };

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-2xl p-5">
      <Dashboard />
    </main>
  );
}
