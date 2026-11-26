import type { UssdApp } from "../lib/types";

interface Props {
  apps: UssdApp[];
  activeId: string;
  onSelect: (appId: string) => void;
}

/** Compact SIM tray above the handset. Colours and icons come from each manifest theme. */
export function AppSwitcher({ apps, activeId, onSelect }: Props) {
  const active = apps.find((a) => a.id === activeId);
  return (
    <div className="w-full max-w-[356px]">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 [text-shadow:0_1px_6px_rgb(0_0_0/0.95)]">
        <span>SIM tray</span>
        {active && <span className="font-semibold text-white/85">{active.name}</span>}
      </div>
      <div
        role="tablist"
        aria-label="Choose a USSD service"
        className="grid gap-1.5 rounded-2xl border border-white/10 bg-[#07070c]/90 p-1.5 backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${Math.max(apps.length, 1)}, minmax(0, 1fr))` }}
      >
        {apps.map((app) => {
          const selected = app.id === activeId;
          return (
            <button
              key={app.id}
              role="tab"
              type="button"
              aria-selected={selected}
              title={`${app.name} · ${app.shortcode}`}
              onClick={() => onSelect(app.id)}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition hover:bg-white/[0.04]"
              style={{
                background: selected ? app.theme.screenBg : undefined,
                boxShadow: selected ? `inset 0 0 0 1px ${app.theme.screenText}66` : undefined,
                color: selected ? app.theme.screenText : "rgba(255, 255, 255, 0.55)",
              }}
            >
              <span className="text-base leading-none" aria-hidden>
                {app.theme.icon}
              </span>
              <span className="font-mono text-[10px] font-semibold tabular-nums">{app.shortcode}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
