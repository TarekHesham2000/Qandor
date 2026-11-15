import SegDigits from "@/components/brand/SegDigits";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl text-brand-600"><SegDigits value={404} digits={3} glow={false} /></div>
      <h1 className="mt-6 text-2xl font-black">الصفحة دي مش موجودة</h1>
      <p className="mt-2 text-ink/65">اتأكد من الرابط، أو ارجع للصفحة الرئيسية وادوّر على المحل.</p>
      <a href="/" className="btn btn-primary mt-6">الصفحة الرئيسية</a>
    </main>
  );
}
