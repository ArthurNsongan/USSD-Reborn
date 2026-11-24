import type { UssdApp } from "../lib/types";

interface Props {
  apps: UssdApp[];
  activeId: string;
  onSelect: (appId: string) => void;
}

/** One card per manifest. Colours come from each app theme, never from this file. */
export function AppSwitcher({ apps, activeId, onSelect }: Props) {
  return (
    <nav aria-label="USSD apps" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {apps.map((app, index) => {
        const active = app.id === activeId;
        return (
          <button
            key={app.id}
            type="button"
            onClick={() => onSelect(app.id)}
            aria-pressed={active}
            className="group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5"
            style={{
              borderColor: active ? app.theme.primaryColor : "rgb(255 255 255 / 0.08)",
              background: active
                ? `linear-gradient(135deg, ${app.theme.screenBg}, ${app.theme.bezelColor})`
                : "rgb(17 19 24 / 0.6)",
              boxShadow: active ? `0 0 0 1px ${app.theme.primaryColor}, 0 12px 40px -12px ${app.theme.primaryColor}` : "none",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {app.theme.icon}
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">App {index + 1}</div>
                  <div className="text-lg font-bold" style={{ color: active ? app.theme.screenText : "#f3f4f6" }}>
                    {app.name}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <code
                  className="rounded-md px-2 py-0.5 font-mono text-sm font-semibold"
                  style={{ background: `${app.theme.primaryColor}33`, color: app.theme.accentColor }}
                >
                  {app.shortcode}
                </code>
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: app.theme.accentColor }}>
                  {app.theme.badgeLabel}
                </span>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-white/60">{app.tagline}</p>
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {[app.theme.screenBg, app.theme.screenText, app.theme.primaryColor, app.theme.accentColor].map((c) => (
                <span key={c} className="h-2 w-6 rounded-full ring-1 ring-white/10" style={{ background: c }} />
              ))}
              <span className="ml-auto font-mono text-[10px] text-white/40">
                {Object.keys(app.nodes).length} nodes · v{app.version}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
