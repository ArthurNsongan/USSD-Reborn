import type { Metrics, TelecomResult, UssdApp, UssdFrame, UssdRequest } from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new ApiError(response.status, `${path} answered HTTP ${response.status}`);
  return (await response.json()) as T;
}

export const fetchApps = (): Promise<UssdApp[]> => getJson<UssdApp[]>("/api/apps");

export const fetchMetrics = (): Promise<Metrics> => getJson<Metrics>("/api/metrics");

/** Simulator channel: JSON in, rich frame out. */
export async function sendUssd(request: UssdRequest): Promise<{ frame: UssdFrame; roundTripMs: number }> {
  const started = performance.now();
  const response = await fetch("/ussd", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new ApiError(response.status, `/ussd answered HTTP ${response.status}`);
  const frame = (await response.json()) as UssdFrame;
  return { frame, roundTripMs: Math.round(performance.now() - started) };
}

export interface TelecomFields {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

/** Telecom channel: exactly what Africa's Talking sends (form-urlencoded in, text/plain out). */
export async function sendTelecomForm(fields: TelecomFields): Promise<TelecomResult> {
  const started = performance.now();
  const response = await fetch("/ussd", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...fields, networkCode: "62401" }).toString(),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text(),
    roundTripMs: Math.round(performance.now() - started),
  };
}

/** Random session id. getRandomValues also works outside secure contexts (e.g. LAN demo over http). */
export function randomId(prefix: string, length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length / 2));
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Backend origin to show in copyable curl commands (the Vite dev server proxies to port 8000). */
export function backendOrigin(): string {
  const { origin, port, hostname } = window.location;
  return port === "5173" ? `http://${hostname}:8000` : origin;
}
