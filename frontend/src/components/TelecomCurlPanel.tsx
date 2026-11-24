import { useEffect, useMemo, useState } from "react";
import { backendOrigin, randomId, sendTelecomForm } from "../lib/api";
import type { TelecomResult, UssdApp } from "../lib/types";

interface Props {
  apps: UssdApp[];
  activeApp: UssdApp;
}

const newAtSession = () => randomId("ATUid_");

/** Single-quote a value for POSIX shells (the copyable curl command). */
const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export function TelecomCurlPanel({ apps, activeApp }: Props) {
  const [sessionId, setSessionId] = useState(newAtSession);
  const [serviceCode, setServiceCode] = useState(activeApp.shortcode);
  const [phoneNumber, setPhoneNumber] = useState("+237690000000");
  const [text, setText] = useState("");
  const [result, setResult] = useState<TelecomResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setServiceCode(activeApp.shortcode), [activeApp.shortcode]);

  const curl = useMemo(() => {
    const fields = { sessionId, serviceCode, phoneNumber, text };
    const data = Object.entries(fields)
      .map(([key, value]) => `  --data-urlencode ${shellQuote(`${key}=${value}`)}`)
      .join(" \\\n");
    return `curl -X POST ${backendOrigin()}/ussd \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n${data}`;
  }, [sessionId, serviceCode, phoneNumber, text]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await sendTelecomForm({ sessionId, serviceCode, phoneNumber, text }));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const field = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--brand-primary)]";

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        This is the exact request an operator gateway such as Africa's Talking sends:{" "}
        <code className="font-mono text-white/80">application/x-www-form-urlencoded</code> in,{" "}
        <code className="font-mono text-white/80">text/plain</code> <code className="font-mono">CON</code>/<code className="font-mono">END</code> out.
        The <code className="font-mono">text</code> field carries the whole history, e.g. <code className="font-mono">1*1*1</code>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-white/50">
          <span>sessionId</span>
          <div className="flex gap-2">
            <input className={field} value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
            <button type="button" onClick={() => setSessionId(newAtSession())} className="key rounded-lg px-3 text-white/80" title="New session">
              ↻
            </button>
          </div>
        </label>
        <label className="space-y-1 text-xs text-white/50">
          <span>serviceCode</span>
          <select className={field} value={serviceCode} onChange={(e) => setServiceCode(e.target.value)}>
            {apps.map((app) => (
              <option key={app.id} value={app.shortcode}>
                {app.shortcode} · {app.name}
              </option>
            ))}
            <option value="*000#">*000# · unknown code</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/50">
          <span>phoneNumber</span>
          <input className={field} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-white/50">
          <span>text (cumulative)</span>
          <input className={field} value={text} placeholder="empty = first dial" onChange={(e) => setText(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Sending..." : "POST /ussd"}
        </button>
        {activeApp.quickPresets.map((preset) => (
          <button
            key={preset.inputs}
            type="button"
            onClick={() => {
              setText(preset.inputs);
              setSessionId(newAtSession());
            }}
            className="key rounded-lg px-3 py-2 font-mono text-xs text-white/70"
            title={preset.label}
          >
            text={preset.inputs.length > 14 ? `${preset.inputs.slice(0, 12)}…` : preset.inputs}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 font-mono text-xs text-white/60">
            <span>HTTP {result.status}</span>
            <span>{result.contentType}</span>
            <span>{result.body.length} chars</span>
            <span>{result.roundTripMs} ms</span>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[13px] text-white/90">{result.body}</pre>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/45">Same request with curl</span>
          <button type="button" onClick={copy} className="key rounded-md px-2 py-1 text-xs text-white/80">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-white/80">{curl}</pre>
      </div>
    </div>
  );
}
