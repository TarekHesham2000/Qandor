import { ChevronDown } from "lucide-react";

// أسئلة بصيغة اللي هيسألها صاحب المحل فعلاً، والإجابات بتقول الحقيقة بما فيها اللي لسه ما اتعملش
const ITEMS: { q: string; a: string }[] = [
  { q: "العميل محتاج يحمّل تطبيق؟", a: "لا. بيفتح الرابط أو يمسح الـ QR وبيشتغل من متصفح موبايله على طول." },
  { q: "العميل لازم يعمل حساب؟", a: "لا. بيكتب اسمه ورقم موبايله وياخد رقمه. الحساب لصاحب النشاط بس." },
  { q: "لو العميل مش معاه موبايل؟", a: "تضيفه إنت من صفحة التحكم، بالاسم أو من غير اسم، وتناديه بالرقم زي ما بتعمل دلوقتي." },
  { q: "الحلاق أو الدكتور محتاج حساب؟", a: "لا. كل واحد بياخد لينك خاص بيفتحه على موبايله، وفيه زر «خلصت ← التالي» وزر «تخطي»." },
  { q: "الأرقام بتبدأ من 1 إمتى؟", a: "كل يوم من منتصف الليل بتوقيت القاهرة، ولكل حلاق أو دكتور ترقيمه المنفصل." },
  { q: "هيجيلي تنبيه على واتساب؟", a: "لسه. حالياً صفحة العميل بتطلّع صوت واهتزاز لما دوره يجي وهي مفتوحة. تنبيهات واتساب جاية قريب." },
  { q: "بيكلّف كام؟", a: "حالياً مجاني أثناء الإطلاق." },
];

export default function Faq() {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {ITEMS.map((it) => (
        <details key={it.q} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown className="h-5 w-5 shrink-0 text-ink/50 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 max-w-prose leading-7 text-ink/70">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
