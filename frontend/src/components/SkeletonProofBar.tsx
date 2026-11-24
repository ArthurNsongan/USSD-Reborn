import type { Metrics } from "../lib/types";

interface Props {
  metrics: Metrics | null;
}

function Chip({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const tone = ok === undefined ? "text-white/80" : ok ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1">
      <span className="text-[10px] uppercase tracking-widest text-white/45">{label}</span>
      <span className={`font-mono text-xs font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

/** Live Skeleton Crew proof, computed by the backend audit on every request to /api/metrics. */
export function SkeletonProofBar({ metrics }: Props) {
  if (!metrics) {
    return <div className="font-mono text-xs text-white/40">Loading skeleton audit...</div>;
  }
  const loc = metrics.core_loc ?? 0;
  const max = metrics.max_loc ?? 400;
  const leaks = metrics.domain_leaks ?? 0;
  const ratio = Math.min(100, (loc / max) * 100);
  const files = Object.entries(metrics.files ?? {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}: ${count}`)
    .join("\n");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1"
        title={files ? `core/ logical lines\n${files}` : undefined}
      >
        <span className="text-[10px] uppercase tracking-widest text-white/45">core/</span>
        <span className={`font-mono text-xs font-semibold ${loc < max ? "text-emerald-300" : "text-rose-300"}`}>
          {loc} / {max} LOC
        </span>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
          <span
            className={`block h-full rounded-full ${loc < max ? "bg-emerald-400" : "bg-rose-400"}`}
            style={{ width: `${ratio}%` }}
          />
        </span>
      </div>
      <Chip label="Domain leaks" value={String(leaks)} ok={leaks === 0} />
      <Chip label="Apps" value={String(metrics.apps_loaded)} />
      <Chip label="Sessions" value={String(metrics.active_sessions)} />
      <Chip label="GSM-7 ≤ 160" value="enforced" ok />
    </div>
  );
}
