import { useCallback, useState } from "react";
import { getInitialTheme, persistTheme, type Theme } from "./theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
