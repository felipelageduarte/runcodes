const STORAGE_KEY = "runcodes.theme";

export type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolves the theme to apply on first paint: explicit user choice
 * (persisted) wins, otherwise follow the OS preference — see
 * docs/frontend/design-system.md#tema-e-tokens ("dark mode não é
 * opcional nesse público"). */
export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
