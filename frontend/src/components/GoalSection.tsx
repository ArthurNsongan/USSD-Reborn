import { Section } from "./Section";

const PILLARS = [
  {
    kicker: "The dead zone problem",
    title: "Apps don't reach basic phones",
    body:
      "Outside city centres, mobile data is expensive or simply absent, and millions of people still carry push-button phones. A smartphone app, however good, never reaches them.",
  },
  {
    kicker: "The 2G ghost channel",
    title: "USSD still works everywhere",
    body:
      "USSD, the protocol behind codes like *126#, rides the 2G signalling channel. It needs no mobile data and no install, and it works on any GSM phone. But every USSD menu is usually hand-coded for one single service.",
  },
  {
    kicker: "One skeleton",
    title: "One engine, any service",
    body:
      "GhostSignal is a small, domain-agnostic engine that runs any USSD service described in a JSON file. A new service is a new manifest, never new engine code.",
  },
];

export function GoalSection() {
  return (
    <Section
      id="goal"
      index="01"
      eyebrow="The goal"
      title={
        <>
          Why resurrect{" "}
          <span className="font-editorial font-normal italic" style={{ color: "var(--screen-text)" }}>
            2G USSD
          </span>
          ?
        </>
      }
      intro="To reach the phones the Internet forgot. USSD-Reborn brings useful, modern services back to the oldest channel that still reaches everyone."
    >
      <div className="grid gap-5 md:grid-cols-3" data-reveal-group>
        {PILLARS.map((pillar, index) => (
          <article key={pillar.kicker} className="panel rounded-3xl p-7" data-reveal>
            <div className="font-mono text-xs text-white/40">
              0{index + 1} · {pillar.kicker}
            </div>
            <h3 className="mt-4 font-display text-xl font-bold leading-snug">{pillar.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{pillar.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
