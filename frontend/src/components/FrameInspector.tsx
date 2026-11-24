import type { CompressionMode, HistoryEntry, UssdFrame } from "../lib/types";

interface Props {
  frame: UssdFrame | null;
  history: HistoryEntry[];
}

const MODE_LABEL: Record<CompressionMode, string> = {
  direct: "DIRECT",
  ai: "AI_LLM",
  deterministic_fallback: "DETERMINISTIC_FALLBACK",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <div className={`mt-0.5 truncate font-mono text-sm font-semibold ${color}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function Gauge({ count, max }: { count: number; max: number }) {
  const ratio = Math.min(1, count / max);
  const color = count > max ? "bg-rose-500" : count > max * 0.9 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-xs text-white/60">
        <span>frame length (prefix + body + footer)</span>
        <span className="font-semibold text-white">
          {count} / {max} chars
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${ratio * 100}%` }} />
        <div className="absolute inset-y-0 right-0 w-px bg-white/50" />
      </div>
    </div>
  );
}

/** Makes invisible protocol details visible: newlines and the CON/END prefix. */
function RawFrame({ raw }: { raw: string }) {
  const [prefix, ...rest] = raw.split(" ");
  const body = rest.join(" ");
  return (
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[13px] leading-relaxed text-white/90">
      <span className="rounded bg-[var(--brand-primary)] px-1 font-bold text-black">{prefix}</span>{" "}
      {body.split("\n").map((line, index, lines) => (
        <span key={index}>
          {line}
          {index < lines.length - 1 && <span className="text-[var(--brand-accent)] opacity-60">↵{"\n"}</span>}
        </span>
      ))}
    </pre>
  );
}

export function FrameInspector({ frame, history }: Props) {
  if (!frame) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center text-center text-sm text-white/50">
        Dial a shortcode or pick a Quick demo: every frame exchanged with the gateway appears here.
      </div>
    );
  }
  const t = frame.telemetry;
  const fallbackTone = t.mode === "deterministic_fallback" ? "warn" : "ok";

  return (
    <div className="space-y-4">
      <RawFrame raw={frame.raw_response} />
      <Gauge count={frame.char_count} max={frame.max_chars} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Prefix" value={frame.prefix === "CON" ? "CON · continue" : "END · close"} />
        <Stat label="GSM-7 alphabet" value={frame.gsm7_valid ? "valid" : "INVALID"} tone={frame.gsm7_valid ? "ok" : "bad"} />
        <Stat label="Compression" value={MODE_LABEL[t.mode] ?? t.mode} tone={fallbackTone} />
        <Stat label="Fallback reason" value={t.fallback_reason ?? "none"} />
        <Stat label="Page" value={`${frame.page_index + 1} / ${frame.total_pages}`} />
        <Stat label="Content raw → compressed" value={t.raw_length !== undefined ? `${t.raw_length} → ${t.compressed_length}` : "n/a"} />
        <Stat label="Compressor latency" value={`${t.latency_ms ?? 0} ms`} />
        <Stat label="Node" value={frame.current_node} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-white/45">Navigation stack (SQLite)</div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2 font-mono text-xs">
            {[...frame.stack, frame.current_node].map((node, index, all) => (
              <span key={`${node}-${index}`} className="flex items-center gap-1">
                <span className={index === all.length - 1 ? "rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-black" : "text-white/70"}>
                  {node}
                </span>
                {index < all.length - 1 && <span className="text-white/30">›</span>}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-white/45">Session context</div>
          <pre className="max-h-28 overflow-auto rounded-xl border border-white/10 bg-black/30 p-2 font-mono text-xs text-white/80">
            {JSON.stringify(frame.context, null, 2)}
          </pre>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-widest text-white/45">Session exchanges</div>
        <ol className="max-h-56 space-y-1 overflow-auto font-mono text-xs">
          {[...history].reverse().map((entry, index) => (
            <li key={history.length - index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg bg-black/25 px-2 py-1.5">
              <span className="text-[var(--brand-accent)]">› {entry.input || "(dial)"}</span>
              <span className="truncate text-white/60">{entry.frame.raw_response.replace(/\n/g, " ↵ ")}</span>
              <span className="text-white/45">
                {entry.frame.char_count}c · {MODE_LABEL[entry.frame.telemetry.mode]} · {entry.roundTripMs}ms
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
