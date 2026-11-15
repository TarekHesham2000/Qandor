import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata = { title: "باسوورد جديد — قندور", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-center text-2xl font-bold text-teal-700">تعيين باسوورد جديد</h1>
      <ResetPasswordForm />
    </main>
  );
}
