"use client";

import { useMemo, useState } from "react";
import type { DirectoryItem } from "@/lib/types";

const KINDS = [
  { key: "all", label: "الكل" },
  { key: "clinic", label: "عيادات" },
  { key: "barber", label: "حلاقين" },
  { key: "lab", label: "معامل" },
] as const;

const ICON: Record<DirectoryItem["kind"], string> = { clinic: "🩺", barber: "💈", lab: "🧪", other: "📍" };

// فلترة محلية: القايمة صغيرة (حد أقصى 200) فمش محتاجين طلب شبكة مع كل حرف
export default function BusinessDirectory({ items }: { items: DirectoryItem[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((b) => (kind === "all" || b.kind === kind) && (!needle || b.name.toLowerCase().includes(needle)));
  }, [items, q, kind]);

  return (
    <section className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث باسم العيادة أو الصالون"
        className="input"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
              kind === k.key ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-ink/15 hover:ring-ink/30"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-slate-400">لسه مفيش أنشطة مسجلة. كن أول واحد!</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-400">مفيش نتائج مطابقة.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((b) => (
            <li key={b.slug}>
              <a
                href={`/b/${b.slug}`}
                className="card flex items-center justify-between p-4 transition hover:shadow-md"
              >
                <span className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{ICON[b.kind]}</span>
                  <span className="font-display font-bold">{b.name}</span>
                </span>
                <span className="text-sm font-medium text-brand-600">احجز ←</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
