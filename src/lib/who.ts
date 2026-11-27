// الكلمة اللي بتوصف "مين بيخدم العميل" حسب نوع النشاط (kind)
// في الداتابيز قيمة الصالون/الحلاق هي "barber"؛ بنقبل "salon" كمان كاسم بديل.
const WHO: Record<string, string> = {
  clinic: "دكتور",
  barber: "حلاق",
  salon: "حلاق",
  lab: "قسم",
  other: "الشباك",
};

const WHO_PLURAL: Record<string, string> = {
  clinic: "الدكاترة",
  barber: "الحلاقين",
  salon: "الحلاقين",
  lab: "الأقسام",
  other: "الشبابيك",
};

const FALLBACK = "other";

function pick(map: Record<string, string>, kind?: string | null): string {
  return (kind && Object.hasOwn(map, kind) ? map[kind] : map[FALLBACK]);
}

/** الكلمة المفردة: دكتور / حلاق / قسم / الشباك (أي نوع مش معروف يرجّع «الشباك») */
export function whoFor(kind?: string | null): string {
  return pick(WHO, kind);
}

/** الجمع للعناوين: الدكاترة / الحلاقين / الأقسام / الشبابيك */
export function whoPluralFor(kind?: string | null): string {
  return pick(WHO_PLURAL, kind);
}
