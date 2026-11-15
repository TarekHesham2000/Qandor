// علامة قندور: تذكرة بنتوءين جانبيين ورقم "1" مضيء. الشكل نفسه بيحكي الفكرة.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <mask id="qm">
          <rect width="32" height="32" rx="8" fill="#fff" />
          <circle cx="0" cy="22" r="4" fill="#000" />
          <circle cx="32" cy="22" r="4" fill="#000" />
        </mask>
      </defs>
      <rect width="32" height="32" rx="8" fill="#3b4ce8" mask="url(#qm)" />
      <path d="M19 8.5l3 2v13a1.5 1.5 0 0 1-3 0z" fill="#ffb224" transform="translate(-1.5 0)" />
      <rect x="8.5" y="9" width="3" height="6" rx="1.5" fill="#ffb224" opacity="0.22" />
    </svg>
  );
}

export default function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className={`font-display text-xl font-extrabold leading-none ${light ? "text-white" : "text-ink"}`}>قندور</span>
    </span>
  );
}
