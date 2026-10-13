import { LayoutDashboard, Store, ShieldCheck, LifeBuoy } from "lucide-react";
import { UserType } from "@runcodes/shared";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Omit for "any authenticated user". */
  minType?: number;
}

// Placeholder set for Fase 0 — student/professor dashboards get real
// content in Fases 1/3 (docs/frontend/roadmap.md); the nav contract
// (role-filtered items, same shell) is what this phase establishes.
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/marketplace", label: "Marketplace", icon: Store, minType: UserType.PROFESSOR },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  { to: "/admin", label: "Admin", icon: ShieldCheck, minType: UserType.ADMIN },
];

export function visibleNavItems(userType: number | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.minType === undefined || (userType ?? -1) >= item.minType);
}
