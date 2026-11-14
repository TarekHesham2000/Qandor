import AuthForm from "@/components/AuthForm";

export const metadata = { title: "دخول صاحب المحل — قندور" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-center text-3xl font-bold text-teal-700">قندور</h1>
      <p className="mb-6 text-center text-sm text-slate-500">دخول صاحب العيادة أو المحل</p>
      <AuthForm />
    </main>
  );
}
