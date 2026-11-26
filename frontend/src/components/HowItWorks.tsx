import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { randomId, sendUssd } from "../lib/api";
import type { UssdApp, UssdFrame } from "../lib/types";
import { Section } from "./Section";

interface Props {
  app: UssdApp;
}

/** Formats the entry node of the live manifest as a compact JSON excerpt (one option per line). */
function manifestExcerpt(app: UssdApp): string {
  const home = app.nodes[app.entryNode];
  if (!home) return "";
  const options = home.options.map(
    (o, i) =>
      `      { "key": "${o.key}", "label": ${JSON.stringify(o.label)}, "next": "${o.next}" }${
        i < home.options.length - 1 ? "," : ""
      }`,
  );
  return [
    `"nodes": {`,
    `  "${app.entryNode}": {`,
    `    "type": "${home.type}",`,
    `    "title": ${JSON.stringify(home.title)},`,
    `    "options": [`,
    ...options,
    `    ]`,
    `  }, ...`,
    `}`,
  ].join("\n");
}

export function HowItWorks({ app }: Props) {
  const [frame, setFrame] = useState<UssdFrame | null>(null);
  const pipelineRef = useRef<HTMLOListElement>(null);

  // A spectral pulse travels the cable 1 -> 2 -> 3 -> 4, lighting each step as it arrives.
  useLayoutEffect(() => {
    const root = pipelineRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const dots = root.querySelectorAll<HTMLElement>("[data-step-dot]");
      const pulses = root.querySelectorAll<HTMLElement>(".beam-pulse");
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
      dots.forEach((dot, index) => {
        timeline
          .to(dot, { scale: 1.22, backgroundColor: "rgba(255, 255, 255, 0.12)", duration: 0.18, ease: "power2.out" })
          .to(dot, { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)", duration: 0.35, ease: "power2.inOut" });
        const pulse = pulses[index];
        if (pulse) {
          timeline
            .fromTo(pulse, { left: "0%", opacity: 0 }, { left: "100%", opacity: 1, duration: 0.75, ease: "power1.inOut" }, "<")
            .set(pulse, { opacity: 0 });
        }
      });
    });
    return () => mm.revert();
  }, []);

  // Real round trip through the skeleton: the right-hand screen is what core/ actually returns.
  useEffect(() => {
    let alive = true;
    setFrame(null);
    sendUssd({ session_id: randomId("doc-"), app_id: app.id, phone_number: "+237690000000", text: "", input_mode: "cumulative" })
      .then(({ frame: next }) => {
        if (alive) setFrame(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [app.id]);

  const steps = [
    {
      tag: "Handset",
      title: "Dial",
      body: `The user dials ${app.shortcode} on any GSM phone. No data plan, no app to install.`,
    },
    {
      tag: "POST /ussd",
      title: "Gateway",
      body: "The operator's USSD gateway (e.g. Africa's Talking) posts the session id, the code and the typed text to our webhook.",
    },
    {
      tag: "core/ < 400 lines",
      title: "Skeleton",
      body: "The engine loads the app's manifest, moves the CON/END state machine one step and calls the app's pure handler functions.",
    },
    {
      tag: "≤ 160 chars",
      title: "Fit the screen",
      body: "The compressor fits the answer into 160 GSM-7 characters (AI rewrite or deterministic fallback) and pages longer text with 99.",
    },
  ];

  return (
    <Section
      id="how"
      index="02"
      eyebrow="How it works"
      title="From a keypress to a 160-character screen."
      intro="Every USSD exchange is one HTTP request and one plain-text answer. GhostSignal handles the protocol once, so each service only has to describe its screens."
    >
      <ol ref={pipelineRef} className="grid gap-4 md:grid-cols-4" data-reveal-group>
        {steps.map((step, index) => (
          <li key={step.title} className="relative" data-reveal>
            <div className="flex items-center gap-3">
              <span
                data-step-dot
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold"
                style={{ borderColor: "var(--screen-text)", color: "var(--screen-text)" }}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 && (
                <span className="relative hidden h-px flex-1 bg-white/15 md:block" aria-hidden>
                  <span className="beam-pulse" />
                </span>
              )}
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
            <code className="mt-1 inline-block rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white/60">{step.tag}</code>
            <p className="mt-3 pr-4 text-sm leading-relaxed text-white/60">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-16">
        <h3 className="font-display text-xl font-bold">A live example</h3>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          On the left, the start of <code className="font-mono text-white/80">apps/{app.id}/manifest.json</code>. On the right, the
          frame the skeleton returned for it a moment ago. Edit the JSON and the screen changes; <code className="font-mono">core/</code>{" "}
          never does.
        </p>

        <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)]">
          <div className="panel overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 px-4 py-2 font-mono text-[11px] text-white/45">apps/{app.id}/manifest.json</div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-white/80">{manifestExcerpt(app)}</pre>
          </div>

          <div className="flex items-center justify-center font-mono text-xs text-white/40" aria-hidden>
            <span className="rotate-90 lg:rotate-0">→ core/ →</span>
          </div>

          <div className="panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-[11px] text-white/45">
              <span>HTTP 200 · text/plain</span>
              {frame && (
                <span className="tabular-nums">
                  {frame.char_count} / {frame.max_chars} chars
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="lcd rounded-xl px-4 py-3 text-[20px] leading-[1.1]">
                <pre className="whitespace-pre-wrap break-words font-[inherit]">{frame ? frame.raw_response : "Dialing..."}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
