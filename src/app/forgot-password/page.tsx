import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata = { title: "استرجاع الباسوورد — دوري", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="text-3xl font-black">استرجاع الباسوورد</h1>
      <p className="mb-7 mt-2 text-ink/65">اكتب إيميلك وهنبعتلك رابط تعيين باسوورد جديد.</p>
      <ForgotPasswordForm />
    </main>
  );
}
