// أرقام 7-segment زي شاشات العيادات. SVG عشان تتكبّر لأي حجم وتتلوّن بـ currentColor.
// القطع المطفية بتفضل ظاهرة بشفافية خفيفة، وده اللي بيدي الإحساس الحقيقي للـ LED.

type Seg = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const POLY: Record<Seg, string> = {
  a: "8,4 12,0 44,0 48,4 44,8 12,8",
  g: "8,48 12,44 44,44 48,48 44,52 12,52",
  d: "8,92 12,88 44,88 48,92 44,96 12,96",
  f: "4,6 8,10 8,42 4,46 0,42 0,10",
  b: "52,6 56,10 56,42 52,46 48,42 48,10",
  e: "4,50 8,54 8,86 4,90 0,86 0,54",
  c: "52,50 56,54 56,86 52,90 48,86 48,54",
};

const ON: Record<string, Seg[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

function Digit({ ch }: { ch: string }) {
  const on = new Set(ON[ch] ?? []);
  return (
    <svg viewBox="0 0 56 96" style={{ height: "1em", width: "calc(1em * 56 / 96)" }} aria-hidden>
      {(Object.keys(POLY) as Seg[]).map((s) => (
        <polygon key={s} points={POLY[s]} fill="currentColor" opacity={on.has(s) ? 1 : 0.06} />
      ))}
    </svg>
  );
}

/**
 * value: الرقم (أو null لعرض شرطات). digits: أقل عدد خانات (الخانات الزيادة بتتعرض مطفية).
 * الحجم بيتحدد بـ font-size من برّه (مثلاً text-7xl) لأن كل شيء هنا بوحدة em.
 * dir="ltr" مقصود: الأرقام بتتقرا شمال ليمين حتى جوه صفحة RTL.
 */
export default function SegDigits({
  value,
  digits = 2,
  glow = true,
  className = "",
}: {
  value: number | null;
  digits?: number;
  glow?: boolean;
  className?: string;
}) {
  const text = value == null ? "-".repeat(digits) : String(Math.max(0, Math.floor(value))).padStart(digits, " ");
  return (
    <span
      dir="ltr"
      role="img"
      aria-label={value == null ? "لا يوجد" : String(value)}
      // key بتتغير مع القيمة فالحركة بتشتغل من جديد كل ما الرقم يتغير
      key={text}
      className={`inline-flex items-center gap-[0.12em] animate-led-tick ${glow ? "led-glow" : ""} ${className}`}
    >
      {text.split("").map((ch, i) => (
        <Digit key={i} ch={ch} />
      ))}
    </span>
  );
}
