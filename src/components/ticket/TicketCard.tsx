import { Check } from "lucide-react";

export type TicketPhase = "waiting" | "soon" | "serving" | "done" | "skipped" | "cancelled";

const MAX_DOTS = 9;

/** صف النقط: كل نقطة شخص قدامك. أول واحدة اللي بيتخدم، وآخر واحدة "أنت". */
function Dots({ ahead }: { ahead: number }) {
  const shown = Math.min(ahead, MAX_DOTS);
  const extra = ahead - shown;
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {ahead > 0 && <span className="h-3.5 w-3.5 rounded-full bg-ink" title="بيتخدم دلوقتي" />}
      {Array.from({ length: Math.max(0, shown - 1) }).map((_, i) => (
        <span key={i} className="h-2.5 w-2.5 animate-dot-in rounded-full bg-ink/25" />
      ))}
      {extra > 0 && <span className="text-xs font-semibold text-ink/50">+{extra}</span>}
      <span className="ms-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">أنا</span>
    </div>
  );
}

/**
 * تذكرة الدور. شكل ورقة بحواف مثقوبة، والرقم هو البطل.
 * بتتغير ألوانها حسب الحالة: أبيض (منتظر) ← كهرمان (قرّب) ← أخضر (دورك).
 */
export default function TicketCard({
  phase,
  ticketNo,
  ahead,
  estMinutes,
  place,
  customerName,
}: {
  phase: TicketPhase;
  ticketNo: number;
  ahead: number;
  estMinutes: number;
  place: string;
  customerName?: string;
}) {
  const serving = phase === "serving";
  const soon = phase === "soon";
  const finished = phase === "done" || phase === "skipped" || phase === "cancelled";

  const body = serving ? "bg-emerald-600 text-white" : soon ? "bg-led text-ink" : "bg-white text-ink";
  const muted = serving ? "text-emerald-50" : soon ? "text-ink/70" : "text-ink/55";

  return (
    <div className="drop-shadow-[0_10px_18px_rgba(14,23,38,0.12)]">
      <div className={`ticket-shape ${body} relative rounded-3xl px-6 pb-6 pt-5 ${serving ? "animate-ring" : ""}`} style={{ ["--cut" as string]: "66%" }}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm font-medium ${muted}`}>{place}</p>
          {customerName && <p className={`text-sm font-semibold ${muted}`}>{customerName}</p>}
        </div>

        <div className="pb-5 pt-2 text-center">
          <p className={`text-sm ${muted}`}>رقم تذكرتك</p>
          <p className="font-display text-[7.5rem] font-black leading-[1.05] tabular-nums">{ticketNo}</p>
        </div>

        <div className="perforation" style={{ opacity: serving ? 0.45 : 1 }} />

        <div className="min-h-[5.25rem] pt-5 text-center">
          {serving && (
            <>
              <p className="font-display text-2xl font-extrabold">دورك دلوقتي</p>
              <p className="mt-1 text-emerald-50">ادخل، المكان مستنيك.</p>
            </>
          )}
          {(phase === "waiting" || soon) && (
            <div className="flex flex-col items-center gap-3">
              <Dots ahead={ahead} />
              <p className="text-base font-semibold">
                {ahead === 1 ? "قدامك واحد بس" : `قدامك ${ahead}`}
                <span className={`font-normal ${muted}`}> • حوالي {estMinutes} دقيقة</span>
              </p>
            </div>
          )}
          {phase === "done" && (
            <p className="flex items-center justify-center gap-2 font-display text-xl font-bold">
              <Check className="h-5 w-5 text-emerald-600" /> تمت الخدمة
            </p>
          )}
          {phase === "skipped" && <p className="font-semibold text-amber-700">اتخطّى دورك لأنك ما حضرتش.</p>}
          {phase === "cancelled" && <p className="font-semibold text-ink/60">تم إلغاء التذكرة.</p>}
          {finished && <span className="sr-only">انتهت التذكرة</span>}
        </div>
      </div>
    </div>
  );
}
