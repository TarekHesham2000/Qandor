// أرقام الموبايل الدولية: قائمة أكواد الدول + تحويل اللي العميل كتبه لصيغة E.164 (+201012345678)
// السيرفر (_normalize_phone) بيقبل E.164 من 8 لـ 15 رقم، فالتحويل هنا بس لتسهيل الكتابة على العميل.

export type Country = {
  iso: string;
  name: string;
  dial: string; // الكود مع +
  min: number; // أقل طول للرقم المحلي (من غير الصفر الأول)
  max: number; // أكبر طول للرقم المحلي (من غير الصفر الأول)
};

export const COUNTRIES: Country[] = [
  { iso: "EG", name: "مصر", dial: "+20", min: 10, max: 10 },
  { iso: "LY", name: "ليبيا", dial: "+218", min: 9, max: 9 },
  { iso: "SA", name: "السعودية", dial: "+966", min: 9, max: 9 },
  { iso: "AE", name: "الإمارات", dial: "+971", min: 9, max: 9 },
  { iso: "KW", name: "الكويت", dial: "+965", min: 8, max: 8 },
  { iso: "QA", name: "قطر", dial: "+974", min: 8, max: 8 },
  { iso: "BH", name: "البحرين", dial: "+973", min: 8, max: 8 },
  { iso: "OM", name: "عمان", dial: "+968", min: 8, max: 8 },
  { iso: "JO", name: "الأردن", dial: "+962", min: 9, max: 9 },
  { iso: "IQ", name: "العراق", dial: "+964", min: 10, max: 10 },
  { iso: "SD", name: "السودان", dial: "+249", min: 9, max: 9 },
  { iso: "TN", name: "تونس", dial: "+216", min: 8, max: 8 },
  { iso: "DZ", name: "الجزائر", dial: "+213", min: 9, max: 9 },
  { iso: "MA", name: "المغرب", dial: "+212", min: 9, max: 9 },
  { iso: "LB", name: "لبنان", dial: "+961", min: 7, max: 8 },
  { iso: "SY", name: "سوريا", dial: "+963", min: 9, max: 9 },
  { iso: "PS", name: "فلسطين", dial: "+970", min: 9, max: 9 },
  { iso: "YE", name: "اليمن", dial: "+967", min: 9, max: 9 },
  { iso: "TR", name: "تركيا", dial: "+90", min: 10, max: 10 },
  { iso: "GB", name: "بريطانيا", dial: "+44", min: 10, max: 10 },
  { iso: "US", name: "أمريكا وكندا", dial: "+1", min: 10, max: 10 },
  { iso: "DE", name: "ألمانيا", dial: "+49", min: 10, max: 11 },
  { iso: "FR", name: "فرنسا", dial: "+33", min: 9, max: 9 },
  { iso: "IT", name: "إيطاليا", dial: "+39", min: 9, max: 10 },
];

export const DEFAULT_DIAL = "+20";

// الأرقام العربية-الهندية (٠-٩) والفارسية (۰-۹) لأرقام لاتينية
function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const c = ch.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

/**
 * يبني رقم E.164 كامل (مع +) من كود الدولة المختار وما كتبه العميل.
 * - لو العميل كتب + (أو 00) في الأول، الرقم بيتاخد كامل وكود الدولة المختار بيتتجاهل.
 * - غير كده: بيشيل الصفر الأول المحلي ويحط كود الدولة.
 * - بيرجّع "" لو الخانة فاضية (عشان الخانات الاختيارية).
 */
export function buildPhone(countryCode: string, input: string): string {
  const s = toLatinDigits(input).trim();
  let digits = s.replace(/\D/g, "");
  if (!digits) return "";

  // العميل كتب الرقم دولي بنفسه
  if (/^[^\d]*\+/.test(s)) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.replace(/^0+/, "");

  const dial = "+" + toLatinDigits(countryCode).replace(/\D/g, "");
  const code = dial.slice(1);
  digits = digits.replace(/^0+/, ""); // الصفر الأول المحلي

  // العميل كتب الكود من غير + (مثلاً 201012345678 والدولة مصر): منكررهوش
  const c = COUNTRIES.find((x) => x.dial === dial);
  if (c && digits.startsWith(code) && digits.length > c.max) {
    const rest = digits.slice(code.length).replace(/^0+/, "");
    if (rest.length >= c.min && rest.length <= c.max) digits = rest;
  }

  return dial + digits;
}
