import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { LogOut, Moon, Sun, UserCircle, ChevronDown, LifeBuoy } from "lucide-react";
import { useSession, useLogout } from "@runcodes/auth";
import { useTheme } from "@runcodes/shared";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@runcodes/ui";
import { visibleNavSections, mobileNavItems, type NavItem } from "../navigation";
import { ViewAsBar } from "./ViewAsBar";
import { ViewAsMenu } from "./ViewAsMenu";
import { AlertsBanner } from "./AlertsBanner";
import { ServerClock } from "./ServerClock";

function initials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      aria-label={item.label}
      title={item.label}
      className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:text-sidebar-foreground"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="nav-active-pill"
              className="absolute inset-0 rounded-lg bg-sidebar-active"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          {/* Fio coral à esquerda do item ativo — eco do accent histórico */}
          {isActive && (
            <motion.div
              layoutId="nav-active-tick"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
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
  );
}

/** Casca do app: sidebar seccionada (desktop/tablet) + topbar com
 * relógio do servidor + bottom nav (mobile). Relógio do servidor é a
 * assinatura — referência oficial de prazos, como no run.codes
 * original. Ver docs/frontend/design-system.md#responsividade. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const sections = visibleNavSections(user?.type);
  const mobileItems = mobileNavItems(user?.type);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — âncora de marca, cor própria independente do tema. */}
      <aside className="sticky top-0 hidden h-screen w-16 flex-col bg-sidebar px-3 py-4 md:flex lg:w-60">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
            <span className="lg:hidden">rc</span>
            <span className="hidden lg:inline">
              run<span className="text-accent">.</span>codes
            </span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              {section.label && (
                <p className="mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70 lg:block">
                  {section.label}
                </p>
              )}
              {section.label && <div className="mb-1 border-t border-sidebar-border lg:hidden" />}
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Topbar — chrome escuro contínuo com a sidebar, como a navbar
            slate do legado. Relógio do servidor sempre visível. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 bg-sidebar px-4 shadow-md sm:px-6">
          <span className="font-display text-base font-bold tracking-tight text-sidebar-foreground md:hidden">
            run<span className="text-accent">.</span>codes
          </span>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <ServerClock />
            <div className="mx-1 h-6 w-px bg-sidebar-border" />
            <ViewAsMenu collapsedLabel />
            <a
              href="/docs/manual/intro/"
              target="_blank"
              rel="noreferrer"
              aria-label="Manual do usuário"
              title="Manual do usuário"
              className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
            >
              <LifeBuoy aria-hidden="true" className="size-4.5" />
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" className="size-4.5" />
              ) : (
                <Moon aria-hidden="true" className="size-4.5" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu da conta"
                  className="flex items-center gap-1.5 rounded-lg p-1.5 transition-colors hover:bg-sidebar-active"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 font-display text-xs font-bold text-primary-foreground">
                    {initials(user?.name)}
                  </span>
                  <ChevronDown aria-hidden="true" className="hidden size-3.5 text-sidebar-muted sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm font-medium text-foreground">{user?.name}</span>
                  <span className="block truncate font-normal">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/perfil")}>
                  <UserCircle aria-hidden="true" className="size-4" />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/suporte")}>
                  <LifeBuoy aria-hidden="true" className="size-4" />
                  Ajuda
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout.mutate()}>
                  <LogOut aria-hidden="true" className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <ViewAsBar />
        <AlertsBanner />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar/95 backdrop-blur md:hidden">
          {mobileItems.map((item) => (
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
        </nav>
      </div>
    </div>
  );
}
