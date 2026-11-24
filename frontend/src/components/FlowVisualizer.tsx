import { useMemo } from "react";
import type { NodeSpec, NodeType, UssdApp } from "../lib/types";

interface Props {
  app: UssdApp;
  currentNode: string | null;
  path: string[];
  visited: string[];
}

interface Row {
  id: string;
  depth: number;
  edge: string | null;
  repeat: boolean;
}

const TYPE_STYLE: Record<NodeType, string> = {
  menu: "bg-sky-500/15 text-sky-300",
  input: "bg-violet-500/15 text-violet-300",
  action: "bg-amber-500/15 text-amber-300",
  static: "bg-zinc-500/20 text-zinc-300",
};

function edgesOf(node: NodeSpec): Array<{ label: string; target: string }> {
  const edges = node.options.map((o) => ({
    label: `${o.key}. ${o.label}${Object.keys(o.set).length ? `  {${Object.entries(o.set).map(([k, v]) => `${k}=${String(v)}`).join(", ")}}` : ""}`,
    target: o.next,
  }));
  if (node.type === "input" && node.next) edges.push({ label: `input → ${node.saveAs ?? "?"}`, target: node.next });
  return edges;
}

function summary(node: NodeSpec): string {
  if (node.type === "action") return `handler ${node.handler}()${node.useAiCompression ? " · AI compression" : ""}`;
  return (node.title || node.prompt || node.text).split("\n").join(" · ");
}

/** Depth-first flattening; nodes reached again are shown as references instead of repeated subtrees. */
function flatten(app: UssdApp): Row[] {
  const rows: Row[] = [];
  const expanded = new Set<string>();
  const walk = (id: string, depth: number, edge: string | null) => {
    const node = app.nodes[id];
    if (!node) return;
    const repeat = expanded.has(id);
    rows.push({ id, depth, edge, repeat });
    if (repeat) return;
    expanded.add(id);
    for (const { label, target } of edgesOf(node)) walk(target, depth + 1, label);
  };
  walk(app.entryNode, 0, null);
  return rows;
}

export function FlowVisualizer({ app, currentNode, path, visited }: Props) {
  const rows = useMemo(() => flatten(app), [app]);
  const onPath = new Set(path);
  const seen = new Set(visited);
  const counts = Object.values(app.nodes).reduce<Record<string, number>>((acc, n) => ({ ...acc, [n.type]: (acc[n.type] ?? 0) + 1 }), {});

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span>
          Declarative graph loaded from <code className="font-mono text-white/80">apps/{app.id}/manifest.json</code>
        </span>
        {(Object.keys(TYPE_STYLE) as NodeType[]).map((type) => (
          <span key={type} className={`rounded px-1.5 py-0.5 font-mono ${TYPE_STYLE[type]}`}>
            {type} × {counts[type] ?? 0}
          </span>
        ))}
      </div>
      <ul className="max-h-[560px] space-y-1 overflow-auto pr-1 font-mono text-xs">
        {rows.map((row, index) => {
          const node = app.nodes[row.id];
          if (!node) return null;
          const isCurrent = row.id === currentNode && !row.repeat;
          const isOnPath = onPath.has(row.id) && !row.repeat;
          return (
            <li key={`${row.id}-${index}`} style={{ paddingLeft: row.depth * 18 }}>
              {row.edge && <div className="truncate text-[11px] text-white/35">└─ {row.edge}</div>}
              <div
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                  isCurrent
                    ? "border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_22%,transparent)]"
                    : isOnPath
                      ? "border-[color-mix(in_srgb,var(--brand-accent)_45%,transparent)] bg-black/30"
                      : "border-white/5 bg-black/20"
                } ${row.repeat ? "opacity-50" : ""}`}
              >
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${TYPE_STYLE[node.type]}`}>{node.type}</span>
                <span className={isCurrent ? "font-semibold text-white" : "text-white/85"}>{row.id}</span>
                {row.repeat ? (
                  <span className="text-white/40">↪ shown above</span>
                ) : (
                  <span className="truncate text-white/45">{summary(node)}</span>
                )}
                <span className="ml-auto flex shrink-0 gap-1">
                  {node.end && !row.repeat && <span className="rounded bg-rose-500/20 px-1 text-[10px] text-rose-300">END</span>}
                  {seen.has(row.id) && !row.repeat && <span className="text-[var(--brand-accent)]" title="visited in this session">●</span>}
                  {isCurrent && <span className="rounded bg-[var(--brand-primary)] px-1 text-[10px] font-bold text-black">HERE</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
