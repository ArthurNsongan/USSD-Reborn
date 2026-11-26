import type { UssdApp } from "../lib/types";

interface Props {
  apps: UssdApp[];
  activeApp: UssdApp;
  busy: boolean;
  onSelect: (appId: string) => void;
  onPreset: (inputs: string) => void;
}

/**
 * Structured SIM Cartridge Dock:
 * - Top: Featured Everyday Pair (App 1: NightRx Pharmacy *384*1#, App 2: Bite2G Food Delivery *384*2#)
 * - Middle: Secondary SIM cartridges proving 4+ domains run on the exact same < 400 LOC core
 * - Bottom: One-click live scenario chips for the currently loaded SIM (kept outside the phone chassis)
 */
export function AppSwitcher({ apps, activeApp, busy, onSelect, onPreset }: Props) {
  const featured = apps.slice(0, 2);
  const secondary = apps.slice(2);

  return (
    <div className="space-y-4">
      {/* Featured Everyday SIM Pair */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            1. Insert a 2G SIM Cartridge (Featured Everyday Apps)
          </span>
          <span className="font-mono text-[11px] text-white/35">0 lines in core/</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((app, index) => {
            const active = app.id === activeApp.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => onSelect(app.id)}
                aria-pressed={active}
                className="sim-card group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5"
                style={{
                  borderColor: active ? app.theme.screenText : "rgba(255, 255, 255, 0.09)",
                  background: active
                    ? `linear-gradient(140deg, ${app.theme.screenBg} 0%, ${app.theme.bezelColor} 100%)`
                    : "rgba(16, 16, 25, 0.72)",
                  boxShadow: active
                    ? `0 0 0 1px ${app.theme.screenText}, 0 16px 40px -14px ${app.theme.primaryColor}`
                    : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-xl ring-1 ring-white/15"
                      style={{ background: `${app.theme.primaryColor}26` }}
                      aria-hidden
                    >
                      {app.theme.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                          SIM 0{index + 1}
                        </span>
                        {active && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: app.theme.screenText, boxShadow: `0 0 8px ${app.theme.screenText}` }}
                          />
                        )}
                      </div>
                      <div
                        className="font-display text-base font-bold tracking-tight"
                        style={{ color: active ? app.theme.screenText : "#f5f2eb" }}
                      >
                        {app.name}
                      </div>
                    </div>
                  </div>

                  <code
                    className="rounded-lg px-2 py-0.5 font-mono text-xs font-bold tabular-nums"
                    style={{ background: `${app.theme.primaryColor}33`, color: app.theme.accentColor }}
                  >
                    {app.shortcode}
                  </code>
                </div>

                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-white/65">{app.tagline}</p>

                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[10px] text-white/40">
                  <span>{app.theme.badgeLabel}</span>
                  <span>{Object.keys(app.nodes).length} USSD nodes</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary SIM Cartridges (AgriPulse, Tontine-Check, etc.) */}
      {secondary.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
              + More SIMs on the same skeleton:
            </span>
            <div className="flex flex-wrap gap-2">
              {secondary.map((app) => {
                const active = app.id === activeApp.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onSelect(app.id)}
                    aria-pressed={active}
                    className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left font-mono text-xs transition hover:border-white/30"
                    style={{
                      borderColor: active ? app.theme.screenText : "rgba(255, 255, 255, 0.1)",
                      background: active ? `${app.theme.primaryColor}2e` : "rgba(255, 255, 255, 0.03)",
                      color: active ? app.theme.screenText : "#e5e7eb",
                    }}
                  >
                    <span aria-hidden>{app.theme.icon}</span>
                    <span className="font-semibold">{app.name}</span>
                    <code className="text-[11px] opacity-75">{app.shortcode}</code>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* One-Click Scenarios for the Active SIM (kept cleanly outside the handset) */}
      {activeApp.quickPresets.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/35 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              2. Instant Scenarios · {activeApp.name}
            </span>
            <span className="font-mono text-[10px] text-white/35">Click to auto-dial on handset →</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {activeApp.quickPresets.map((preset) => (
              <button
                key={preset.inputs}
                type="button"
                disabled={busy}
                onClick={() => onPreset(preset.inputs)}
                className="group flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/85 transition hover:border-[var(--screen-text)] hover:bg-white/[0.07] disabled:opacity-45"
              >
                <span className="truncate font-medium">{preset.label}</span>
                <code
                  className="shrink-0 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
                  style={{ color: "var(--brand-accent)" }}
                >
                  {activeApp.shortcode.replace(/#$/, "")}*
                  {preset.inputs.length > 12 ? `${preset.inputs.slice(0, 10)}…` : preset.inputs}#
                </code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
