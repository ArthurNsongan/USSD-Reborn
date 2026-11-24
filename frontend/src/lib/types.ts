// Mirrors the JSON produced by core/webhook_adapter.py and core/models.py.

export type NodeType = "menu" | "input" | "action" | "static";
export type CompressionMode = "direct" | "ai" | "deterministic_fallback";
export type InputMode = "cumulative" | "step";

export interface Theme {
  primaryColor: string;
  accentColor: string;
  screenBg: string;
  screenText: string;
  bezelColor: string;
  badgeLabel: string;
  icon?: string;
}

export interface Navigation {
  backKey: string;
  homeKey: string;
  nextPageKey: string;
  sessionTimeoutSec: number;
  nextPageLabel: string;
  backLabel: string;
  invalidMessage: string;
  expiredMessage: string;
  errorMessage: string;
}

export interface MenuOption {
  key: string;
  label: string;
  next: string;
  set: Record<string, unknown>;
}

export interface NodeSpec {
  type: NodeType;
  title: string;
  text: string;
  prompt: string;
  options: MenuOption[];
  saveAs: string | null;
  next: string | null;
  errorMessage: string | null;
  example: string | null;
  handler: string | null;
  useAiCompression: boolean;
  end: boolean;
}

export interface QuickPreset {
  label: string;
  inputs: string;
}

export interface UssdApp {
  id: string;
  name: string;
  tagline: string;
  shortcode: string;
  version: string;
  locale: string;
  entryNode: string;
  theme: Theme;
  navigation: Navigation;
  quickPresets: QuickPreset[];
  nodes: Record<string, NodeSpec>;
}

export interface Telemetry {
  mode: CompressionMode;
  fallback_reason?: string | null;
  raw_length?: number;
  compressed_length?: number;
  latency_ms?: number;
  page_count: number;
  gsm7_valid: boolean;
}

export interface UssdFrame {
  app_id: string;
  session_id: string;
  prefix: "CON" | "END";
  body: string;
  raw_response: string;
  char_count: number;
  max_chars: number;
  gsm7_valid: boolean;
  page_index: number;
  total_pages: number;
  current_node: string;
  stack: string[];
  context: Record<string, unknown>;
  telemetry: Telemetry;
}

export interface UssdRequest {
  session_id: string;
  app_id: string;
  phone_number: string;
  text: string;
  input_mode: InputMode;
}

export interface Metrics {
  core_loc?: number;
  max_loc?: number;
  files?: Record<string, number>;
  domain_leaks?: number;
  passed?: boolean;
  apps_loaded: number;
  active_sessions: number;
}

export interface HistoryEntry {
  at: number;
  input: string;
  roundTripMs: number;
  frame: UssdFrame;
}

export interface TelecomResult {
  status: number;
  contentType: string;
  body: string;
  roundTripMs: number;
}
