// ترجمة أكواد الأخطاء اللي بترميها دوال الـ SQL لرسائل مفهومة للعميل
const MESSAGES: Record<string, string> = {
  queue_closed: "الحجز مقفول دلوقتي. جرّب بعد شوية.",
  queue_not_found: "الطابور ده مش موجود.",
  invalid_name: "اكتب اسمك (حرفين على الأقل).",
  invalid_phone: "رقم الموبايل غير صحيح. مثال: 01012345678",
  queue_full: "الطابور وصل للحد الأقصى دلوقتي. جرّب بعد شوية أو كلّم المحل.",
  too_many_requests: "محاولات كتير في وقت قصير. استنى شوية وجرّب تاني.",
  phone_limit: "الرقم ده حجز أكتر من مرة النهاردة. كلّم المحل لو محتاج مساعدة.",
  ENV_MISSING: "إعدادات الاتصال بالسيرفر ناقصة.",
};

export function toArabicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "";
  for (const key of Object.keys(MESSAGES)) if (raw.includes(key)) return MESSAGES[key];
  return "حصلت مشكلة. جرّب تاني.";
}
