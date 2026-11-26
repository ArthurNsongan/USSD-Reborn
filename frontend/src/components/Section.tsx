import type { ReactNode } from "react";

interface Props {
  id: string;
  index: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}

/** One idea per section: numbered eyebrow, a headline, an optional intro, then the content. */
export function Section({ id, index, eyebrow, title, intro, children }: Props) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/[0.06] py-20 lg:py-28">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">
          <span style={{ color: "var(--screen-text)" }}>{index}</span>
          <span className="h-px w-8 bg-white/20" />
          <span>{eyebrow}</span>
        </div>
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 text-base leading-relaxed text-white/60">{intro}</p>}
      </div>
      <div className="mt-12">{children}</div>
    </section>
  );
}
