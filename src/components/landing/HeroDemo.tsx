"use client";

import { useEffect, useRef, useState } from "react";
import SegDigits from "@/components/brand/SegDigits";
import TicketCard, { type TicketPhase } from "@/components/ticket/TicketCard";

const MY_NO = 7;
const START = 3;
const MINUTES_EACH = 5;

/**
 * تجربة حية لنفس اللي هيحصل في الحقيقي: زر الموظف بيحرّك الشاشة والتذكرة سوا.
 * بتلعب لوحدها كل كام ثانية، وأول ما الزائر يضغط بنفسه بنسيبه يتحكم.
 * لو المستخدم مفعّل "تقليل الحركة" ما بنلعبش لوحدنا.
 */
export default function HeroDemo() {
  const [serving, setServing] = useState(START);
  const [userDriven, setUserDriven] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ahead = MY_NO - serving;
  const phase: TicketPhase = ahead <= 0 ? "serving" : ahead <= 2 ? "soon" : "waiting";

  function next() {
    setServing((s) => (s >= MY_NO ? START : s + 1));
  }

  useEffect(() => {
    if (userDriven || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // الوقفة أطول لما الدور يجي عشان الزائر يلحق يشوفها
    const wait = serving >= MY_NO ? 4200 : 2600;
    const id = setTimeout(next, wait);
    return () => clearTimeout(id);
  }, [userDriven, serving]);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  function press() {
    setUserDriven(true);
    next();
    // لو الزائر سابها بعد ما ضغط، نرجع نلعب لوحدنا بعد فترة
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setUserDriven(false), 12000);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* شاشة الصالة + زر الموظف */}
      <div className="rounded-xl bg-ink p-5 text-led shadow-[0_18px_40px_-12px_rgba(14,23,38,0.55)]">
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>أحمد</span>
          <span>الحالي</span>
        </div>
        <div className="py-3 text-center text-[5.5rem] leading-none">
          <SegDigits value={serving} digits={2} />
        </div>
        <button onClick={press} className="btn btn-led w-full text-lg" aria-label="نادي التالي (تجربة)">
          نادي التالي
        </button>
        <p className="mt-2 text-center text-xs text-white/50">ده زر الموظف. اضغطه وشوف التذكرة تحت.</p>
      </div>

      {/* تذكرة العميل: بتتدلّى تحت الشاشة بميلة خفيفة زي ورقة حقيقية */}
      <div className="-mt-3 rotate-[-1.5deg] px-3">
        <TicketCard
          phase={phase}
          ticketNo={MY_NO}
          ahead={Math.max(ahead, 0)}
          estMinutes={Math.max(ahead, 0) * MINUTES_EACH}
          place="صالون الأمير • أحمد"
        />
      </div>
    </div>
  );
}
