import type { UssdApp } from "../lib/types";
import { Section } from "./Section";

interface Props {
  apps: UssdApp[];
  activeId: string;
  onLoad: (appId: string) => void;
}

/** One card per manifest. Everything shown here (name, colours, features) comes from apps/<id>/manifest.json. */
export function ServicesSection({ apps, activeId, onLoad }: Props) {
  return (
    <Section
      id="services"
      index="03"
      eyebrow="The haunted services"
      title={`${apps.length} everyday apps, 0 lines in core/.`}
      intro={
        <>
          Each service is a folder in <code className="font-mono text-white/80">apps/</code>: a manifest, optional data and a few pure
          functions. None of them adds a single line to <code className="font-mono text-white/80">core/</code>. Load one into the phone
          to try it.
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2" data-reveal-group>
        {apps.map((app) => {
          const active = app.id === activeId;
          const features = app.nodes[app.entryNode]?.options ?? [];
          return (
            <article
              key={app.id}
              data-reveal
              className="flex flex-col rounded-3xl border p-7 transition"
              style={{
                borderColor: active ? `${app.theme.screenText}80` : "rgba(255, 255, 255, 0.08)",
                background: `radial-gradient(120% 90% at 100% 0%, ${app.theme.primaryColor}26, transparent 55%), rgba(14, 14, 22, 0.78)`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: app.theme.screenBg, boxShadow: `inset 0 0 0 1px ${app.theme.screenText}40` }}
                    aria-hidden
                  >
                    {app.theme.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold">{app.name}</h3>
                    <div className="font-mono text-sm" style={{ color: app.theme.screenText }}>
                      {app.shortcode}
                    </div>
                  </div>
                </div>
                {active && (
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest"
                    style={{ background: `${app.theme.screenText}1f`, color: app.theme.screenText }}
                  >
                    In the phone
                  </span>
                )}
              </div>

              <p className="mt-5 text-sm leading-relaxed text-white/65">{app.tagline}</p>

              <ul className="mt-5 space-y-2">
                {features.map((option) => (
                  <li key={option.key} className="flex items-center gap-3 text-sm text-white/80">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold"
                      style={{ background: app.theme.screenBg, color: app.theme.screenText }}
                    >
                      {option.key}
                    </span>
                    {option.label}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                <span className="font-mono text-[11px] text-white/40">
                  {Object.keys(app.nodes).length} screens · {app.locale}
                </span>
                <button
                  type="button"
                  onClick={() => onLoad(app.id)}
                  className="rounded-full px-4 py-2 font-mono text-xs font-bold text-black transition hover:brightness-110"
                  style={{ background: app.theme.screenText }}
                >
                  {active ? "Redial ↑" : "Summon into phone ↑"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-center font-mono text-xs text-white/40">
        Drop a new manifest in apps/ and it shows up here, in the phone, on the telecom webhook and in the MCP server.
      </p>
    </Section>
  );
}
