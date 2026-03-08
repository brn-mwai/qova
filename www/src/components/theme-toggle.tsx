"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeToggle(): ReactElement {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("qova-theme") as Theme | null;
    const initial = stored ?? "system";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);

    // Listen for system changes when in system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (): void => {
      const current = localStorage.getItem("qova-theme") as Theme | null;
      if (!current || current === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cycle = useCallback(() => {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("qova-theme", next);
    applyTheme(next);
  }, [theme]);

  if (!mounted) {
    return (
      <button type="button" className="w-7 h-7 flex items-center justify-center text-[var(--dim)]" aria-label="Toggle theme">
        <i className="hn hn-moon text-sm" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
    >
      {theme === "light" && <i className="hn hn-sun text-sm" />}
      {theme === "dark" && <i className="hn hn-moon text-sm" />}
      {theme === "system" && <i className="hn hn-cog text-sm" />}
    </button>
  );
}
