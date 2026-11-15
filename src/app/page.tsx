import { createClient } from "@supabase/supabase-js";
import { QrCode, Tv, Users, UserPlus, ShieldCheck, Languages, MessageCircle } from "lucide-react";
import Logo from "@/components/brand/Logo";
import SegDigits from "@/components/brand/SegDigits";
import HeroDemo from "@/components/landing/HeroDemo";
import Faq from "@/components/landing/Faq";
import BusinessDirectory from "@/components/BusinessDirectory";
import type { DirectoryItem } from "@/lib/types";

// القايمة بتتغير كل ما نشاط جديد يسجل، فمش هنخزنها في الكاش
export const dynamic = "force-dynamic";

async function loadDirectory(): Promise<DirectoryItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("list_public_businesses");
    // لو الـ migration لسه ما اتشغلتش الصفحة تفضل شغالة بقائمة فاضية بدل ما تقع
    return error ? [] : ((data ?? []) as DirectoryItem[]);
  } catch {
    return [];
  }
}

const STEPS = [
  { t: "العميل يمسح الـ QR", d: "على باب المحل أو من الرابط اللي بتبعته. بيكتب اسمه وموبايله وياخد رقمه." },
  { t: "يتابع دوره من بيته", d: "الصفحة بتتحدث لوحدها: بيشوف رقمه، وقدامه كام واحد، والوقت التقريبي." },
  { t: "يدخل لما يجي دوره", d: "موبايله بيهتز ويطلّع صوت، والحلاق أو الدكتور ينادي اللي بعده بضغطة واحدة." },
];

const FEATURES = [
  { Icon: Tv, t: "شاشة للصالة", d: "رقم كل حلاق بخط كبير مع نغمة ونطق الرقم. بتتفتح على أي تلفزيون أو تابلت." },
  { Icon: QrCode, t: "رابط وQR للمحل", d: "اطبع الـ QR وعلّقه. العميل يحجز في ثواني من غير ما يسأل حد." },
  { Icon: Users, t: "أكتر من حلاق أو دكتور", d: "لكل واحد طابوره ورقمه ولينك تحكم خاص على موبايله، من غير حساب." },
  { Icon: UserPlus, t: "عميل من غير موبايل", d: "ضيفه بنفسك من صفحة التحكم، بالاسم أو من غير اسم." },
  { Icon: ShieldCheck, t: "حماية من الحجز الوهمي", d: "حد أقصى للمنتظرين، وحدود لكل رقم موبايل ولكل جهاز." },
  { Icon: Languages, t: "عربي بالكامل", d: "الواجهة من اليمين لليسار ومظبوطة لشاشة الموبايل." },
  { Icon: MessageCircle, t: "تنبيه واتساب", d: "العميل بيوصله تنبيه قبل دوره على واتساب.", soon: true },
];

export default async function Home() {
  const items = await loadDirectory();

  return (
    <div>
      {/* ───────── الشريط العلوي ───────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink/70 md:flex">
          <a href="#how" className="hover:text-ink">ازاي بيشتغل</a>
          <a href="#features" className="hover:text-ink">المميزات</a>
          <a href="#directory" className="hover:text-ink">الأنشطة</a>
          <a href="#faq" className="hover:text-ink">الأسئلة</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/login" className="btn btn-ghost px-4 py-2 text-sm">دخول</a>
          <a href="/login" className="btn btn-primary hidden px-4 py-2 text-sm sm:inline-flex">سجّل نشاطك</a>
        </div>
      </header>

      <main>
        {/* ───────── الـ Hero: المنتج نفسه هو العرض ───────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-14">
          <div>
            <h1 className="max-w-[16ch] text-[2.6rem] font-black leading-[1.25] sm:text-6xl sm:leading-[1.2]">
              ريّح عملاءك من الوقفة في الطابور.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-8 text-ink/70">
              العميل بيمسح QR ويحجز رقمه ويتابع دوره لحظياً من موبايله، من غير تطبيق ولا حساب.
              وإنت بتنادي اللي بعده بضغطة واحدة.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/login" className="btn btn-primary px-7 py-3.5 text-lg">سجّل نشاطك مجاناً</a>
              <a href="#directory" className="btn btn-ghost px-6 py-3.5 text-lg">شوف الأنشطة المسجلة</a>
            </div>
            <p className="mt-4 text-sm text-ink/55">للعيادات والصالونات والمعامل وأي مكان فيه دور.</p>
          </div>
          <HeroDemo />
        </section>

        <div className="perforation mx-auto max-w-6xl" aria-hidden />

        {/* ───────── ازاي بيشتغل: ترتيب فعلي فالأرقام مقصودة ───────── */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20">
          <h2 className="max-w-xl text-3xl font-extrabold leading-snug sm:text-4xl">من المسح للدخول في 3 خطوات</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
            {STEPS.map((s, i) => (
              <li key={s.t} className={`md:px-8 ${i > 0 ? "md:border-s md:border-dashed md:border-ink/25" : "md:ps-0"}`}>
                <div className="text-5xl text-brand-600"><SegDigits value={i + 1} digits={1} glow={false} /></div>
                <h3 className="mt-5 text-xl font-bold">{s.t}</h3>
                <p className="mt-2 max-w-[22rem] leading-7 text-ink/70">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ───────── المميزات: صفوف مش كروت ───────── */}
        <section id="features" className="scroll-mt-6 bg-ink py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <h2 className="max-w-md text-3xl font-extrabold leading-snug sm:text-4xl">كل اللي المحل محتاجه عشان الدور يمشي لوحده</h2>
              {/* لقطة من شاشة الصالة: نفس الشاشة اللي صاحب المحل هيعلّقها */}
              <div className="mt-10 rounded-xl border border-white/10 bg-black/30 p-5 text-led">
                <div className="grid grid-cols-2 gap-5">
                  {[{ n: "الحلاق أحمد", v: 12, w: 4 }, { n: "الحلاق محمود", v: 7, w: 0 }].map((q) => (
                    <div key={q.n} className="text-center">
                      <p className="text-sm text-white/60">{q.n}</p>
                      <div className="py-2 text-6xl"><SegDigits value={q.v} digits={2} /></div>
                      <p className="text-xs text-white/50">{q.w > 0 ? `المنتظرين: ${q.w}` : "لا يوجد منتظرين"}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm text-white/50">شاشة الصالة</p>
            </div>

            <ul className="divide-y divide-white/10 border-y border-white/10">
              {FEATURES.map(({ Icon, t, d, soon }) => (
                <li key={t} className="flex gap-4 py-5">
                  <Icon className="mt-1 h-6 w-6 shrink-0 text-led" aria-hidden />
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      {t}
                      {soon && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">قريباً</span>}
                    </h3>
                    <p className="mt-1 max-w-md leading-7 text-white/65">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── الأنشطة المسجلة فعلاً ───────── */}
        <section id="directory" className="mx-auto max-w-xl scroll-mt-6 px-5 py-20">
          <h2 className="text-center text-3xl font-extrabold leading-snug sm:text-4xl">أنشطة على قندور دلوقتي</h2>
          <p className="mt-3 text-center text-ink/65">ابحث عن عيادتك أو صالونك واحجز دورك.</p>
          <div className="mt-8">
            <BusinessDirectory items={items} />
          </div>
        </section>

        {/* ───────── الأسئلة ───────── */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-5 pb-20">
          <h2 className="mb-8 text-3xl font-extrabold sm:text-4xl">أسئلة بيسألها أصحاب المحلات</h2>
          <Faq />
        </section>

        {/* ───────── الدعوة الأخيرة ───────── */}
        <section className="bg-ink px-5 py-20 text-center text-white">
          <div className="mx-auto max-w-xl">
            <div className="text-7xl text-led"><SegDigits value={0} digits={2} /></div>
            <p className="mt-1 text-sm text-white/55">منتظرين في الصالة</p>
            <h2 className="mt-8 text-3xl font-extrabold leading-snug sm:text-4xl">جاهز تشيل الزحمة من محلك؟</h2>
            <p className="mt-3 text-white/65">التسجيل بياخد دقايق، وتقدر تطبع الـ QR وتشغّل الشاشة في نفس اليوم.</p>
            <a href="/login" className="btn btn-led mt-8 px-8 py-4 text-lg">سجّل نشاطك مجاناً</a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink/55">
        <Logo size={26} />
        <p>قندور. إدارة الدور للعيادات والصالونات.</p>
        <a href="/login" className="hover:text-ink">دخول صاحب النشاط</a>
      </footer>
    </div>
  );
}
