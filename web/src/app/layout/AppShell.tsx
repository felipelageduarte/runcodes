import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useSession, useLogout } from "@runcodes/auth";
import { useTheme } from "@runcodes/shared";
import { cn } from "@runcodes/ui";
import { visibleNavItems } from "../navigation";
import { ViewAsBar } from "./ViewAsBar";
import { ViewAsMenu } from "./ViewAsMenu";

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
      {/* Desktop/tablet sidebar — cor de marca própria (não acompanha o
          tema claro/escuro do conteúdo), âncora visual tipo o sidebar
          ciano do run.codes original. */}
      <aside className="hidden w-16 flex-col bg-sidebar p-3 md:flex lg:w-56">
        <div className="mb-6 px-2 text-lg font-semibold text-sidebar-foreground">
          <span className="lg:hidden">rc</span>
          <span className="hidden lg:inline">run.codes</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              aria-label={item.label}
              className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:text-sidebar-foreground"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-md bg-sidebar-active"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <item.icon
                    aria-hidden="true"
                    className={cn("relative z-10 size-5 shrink-0", isActive && "text-sidebar-foreground")}
                  />
                  <span className={cn("relative z-10 hidden lg:inline", isActive && "text-sidebar-foreground")}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-2">
          <ViewAsMenu />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" className="size-5 shrink-0" />
            ) : (
              <Moon aria-hidden="true" className="size-5 shrink-0" />
            )}
            <span className="hidden lg:inline">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
          </button>
          <button
            type="button"
            onClick={() => logout.mutate()}
            aria-label="Sair"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
          >
            <LogOut aria-hidden="true" className="size-5 shrink-0" />
            <span className="hidden lg:inline">Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <ViewAsBar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 flex bg-sidebar/95 backdrop-blur md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-sidebar-muted transition-colors",
                  isActive && "text-sidebar-foreground",
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
            className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-sidebar-muted"
          >
            <LogOut className="size-5" />
            Sair
          </button>
        </nav>
      </div>
    </div>
  );
}
