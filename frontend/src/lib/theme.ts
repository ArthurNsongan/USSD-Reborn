import { useEffect } from "react";
import type { UssdApp } from "./types";

/** Applies the selected app theme to CSS variables used by every component. */
export function useThemeVariables(app: UssdApp | null) {
  useEffect(() => {
    if (!app) return;
    const style = document.documentElement.style;
    style.setProperty("--screen-bg", app.theme.screenBg);
    style.setProperty("--screen-text", app.theme.screenText);
    style.setProperty("--brand-primary", app.theme.primaryColor);
    style.setProperty("--brand-accent", app.theme.accentColor);
    style.setProperty("--bezel", app.theme.bezelColor);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", app.theme.bezelColor);
  }, [app]);
}

/** Splits a dialed string such as *384*1*1*1# into the app and its inputs ("1*1"). */
export function parseDial(apps: UssdApp[], composed: string): { app: UssdApp; text: string } | null {
  const code = composed.replace(/\s+/g, "");
  const exact = apps.find((a) => a.shortcode === code);
  if (exact) return { app: exact, text: "" };
  for (const candidate of apps) {
    const base = candidate.shortcode.slice(0, -1);
    if (code.startsWith(`${base}*`) && code.endsWith("#")) return { app: candidate, text: code.slice(base.length + 1, -1) };
  }
  return null;
}
