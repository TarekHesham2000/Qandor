import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata = { title: "استرجاع الباسوورد — قندور", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-teal-700">استرجاع الباسوورد</h1>
      <p className="mb-6 text-center text-sm text-slate-500">اكتب إيميلك وهنبعتلك رابط تعيين باسوورد جديد.</p>
      <ForgotPasswordForm />
    </main>
  );
}
