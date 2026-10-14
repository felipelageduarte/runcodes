import {
  LayoutDashboard,
  Store,
  ShieldCheck,
  LifeBuoy,
  Building2,
  BookOpen,
  FileCog,
  Users,
  ScrollText,
  MessageSquare,
  Workflow,
  Database,
} from "lucide-react";
import { UserType } from "@runcodes/shared";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Omit for "any authenticated user". */
  minType?: number;
  /** Sub-items rendered as a collapsible group under this item. */
  children?: NavItem[];
}

// Placeholder set for Fase 0 — student/professor dashboards get real
// content in Fases 1/3 (docs/frontend/roadmap.md); the nav contract
// (role-filtered items, same shell) is what this phase establishes.
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/marketplace", label: "Marketplace", icon: Store, minType: UserType.PROFESSOR },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
  {
    to: "/admin",
    label: "Admin",
    icon: ShieldCheck,
    minType: UserType.ADMIN,
    children: [
      { to: "/admin/universidades", label: "Instituições", icon: Building2 },
      { to: "/admin/cursos", label: "Disciplinas", icon: BookOpen },
      { to: "/admin/arquivos", label: "Tipos de arquivo", icon: FileCog },
      { to: "/admin/usuarios", label: "Usuários", icon: Users },
      { to: "/admin/logs", label: "Logs", icon: ScrollText },
      { to: "/admin/mensagens", label: "Mensagens", icon: MessageSquare },
      { to: "/admin/pipeline", label: "Pipeline", icon: Workflow },
      { to: "/admin/banco", label: "Banco de dados", icon: Database },
    ],
  },
];

export function visibleNavItems(userType: number | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.minType === undefined || (userType ?? -1) >= item.minType);
}
