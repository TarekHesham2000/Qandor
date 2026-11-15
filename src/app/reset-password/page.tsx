import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata = { title: "باسوورد جديد — راحتك", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="mb-6 text-3xl font-black">تعيين باسوورد جديد</h1>
      <ResetPasswordForm />
    </main>
  );
}
