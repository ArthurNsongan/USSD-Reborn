import { useState } from "react";
import type { UssdApp } from "../lib/types";
import { Section } from "./Section";

interface Props {
  apps: UssdApp[];
}

const PILLARS = [
  {
    count: "3",
    label: "Specs",
    path: ".kiro/specs/",
    body: "skeleton-contract, ussd-gateway and retro-simulator: EARS requirements, a design and ordered tasks for each.",
  },
  {
    count: "7",
    label: "Steering docs",
    path: ".kiro/steering/",
    body: "All three inclusion modes. zero-hardcoding loads whenever core/ is edited; add-ussd-app is a manual playbook.",
  },
  {
    count: "3",
    label: "Hooks",
    path: ".kiro/hooks/",
    body: "On every save: purity audit of core/, the GSM-7 test suite, and a walk through every screen of every app.",
  },
  {
    count: "4",
    label: "MCP tools",
    path: ".kiro/settings/mcp.json",
    body: "Kiro can list the services, dial them, compress any text to GSM-7 and audit the skeleton from chat.",
  },
];

/** Builds chat prompts from the loaded manifests, so nothing app-specific is written in the frontend. */
function buildPrompts(apps: UssdApp[]): string[] {
  const dialPrompts = apps.slice(0, 2).flatMap((app) => {
    const preset = app.quickPresets[Math.min(3, app.quickPresets.length - 1)];
    if (!preset) return [];
    const inputs = preset.inputs
      .split("*")
      .map((value) => `"${value}"`)
      .join(", ");
    return [`Use the ussd-reborn MCP server to dial ${app.shortcode} with inputs [${inputs}] (${preset.label}).`];
  });
  return [...dialPrompts, "Use the ussd-reborn MCP server to run audit_skeleton_compliance and summarise the result."];
}

export function KiroSection({ apps }: Props) {
  const [copied, setCopied] = useState<number | null>(null);
  const prompts = buildPrompts(apps);

  const copy = (prompt: string, index: number) => {
    void navigator.clipboard.writeText(prompt);
    setCopied(index);
    window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1400);
  };

  return (
    <Section
      id="kiro"
      index="05"
      eyebrow="Built with Kiro"
      title="Specs first, guard rails always on."
      intro={
        <>
          The whole process lives in <code className="font-mono text-white/80">.kiro/</code>, committed with the code. The rules that keep
          the skeleton small and generic are enforced by Kiro on every save, not by good intentions.
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal-group>
        {PILLARS.map((pillar) => (
          <article key={pillar.label} className="panel rounded-3xl p-6" data-reveal>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold" style={{ color: "var(--screen-text)" }}>
                {pillar.count}
              </span>
              <span className="font-display text-lg font-bold">{pillar.label}</span>
            </div>
            <code className="mt-2 block font-mono text-[11px] text-white/45">{pillar.path}</code>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{pillar.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-12">
        <h3 className="font-display text-xl font-bold">Try it from Kiro chat</h3>
        <p className="mt-2 text-sm text-white/55">Open the repository in Kiro and paste one of these. Click to copy.</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {prompts.map((prompt, index) => (
            <button
              key={prompt}
              type="button"
              onClick={() => copy(prompt, index)}
              className="panel rounded-2xl p-4 text-left font-mono text-xs leading-relaxed text-white/80 transition hover:border-[var(--screen-text)]"
            >
              <span className="block">{prompt}</span>
              <span className="mt-3 block text-[10px] uppercase tracking-widest" style={{ color: "var(--screen-text)" }}>
                {copied === index ? "Copied" : "Copy prompt"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
