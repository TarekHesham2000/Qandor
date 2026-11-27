import AuthForm from "@/components/AuthForm";
import Logo from "@/components/brand/Logo";

export const metadata = { title: "دخول صاحب النشاط — دوري" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <a href="/" aria-label="الصفحة الرئيسية" className="mb-8 self-start"><Logo /></a>
      <h1 className="text-3xl font-black">دخول صاحب النشاط</h1>
      <p className="mb-7 mt-2 text-ink/65">ادخل عشان تدير الطابور وشاشة الصالة.</p>
      <AuthForm />
    </main>
  );
}
