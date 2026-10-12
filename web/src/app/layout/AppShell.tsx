import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useSession, useLogout } from "@runcodes/auth";
import { useTheme } from "@runcodes/shared";
import { cn } from "@runcodes/ui";
import { visibleNavItems } from "../navigation";

/** Casca com nav responsiva: sidebar (desktop/tablet) + bottom nav
 * (mobile) — ver docs/frontend/design-system.md#responsividade. Três
 * layouts de navegação reais, não uma media query de emergência. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const logout = useLogout();
  const { theme, toggleTheme } = useTheme();
  const items = visibleNavItems(user?.type);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop/tablet sidebar */}
      <aside className="hidden w-16 flex-col border-r border-border p-3 md:flex lg:w-56">
        <div className="mb-6 px-2 text-lg font-semibold text-foreground">
          <span className="lg:hidden">rc</span>
          <span className="hidden lg:inline">run.codes</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive && "bg-primary-50 text-primary-700",
                )
              }
            >
              <item.icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
            <span className="hidden lg:inline">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-5 shrink-0" />
            <span className="hidden lg:inline">Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-card md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground",
                  isActive && "text-primary-700",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground"
          >
            <LogOut className="size-5" />
            Sair
          </button>
        </nav>
      </div>
    </div>
  );
}
