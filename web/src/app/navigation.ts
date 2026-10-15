import {
  LayoutDashboard,
  Store,
  Building2,
  BookOpen,
  BookMarked,
  FileCog,
  Users,
  ScrollText,
  MessageSquare,
  Workflow,
  Database,
  GraduationCap,
} from "lucide-react";
import { UserType } from "@runcodes/shared";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Omit for "any authenticated user". */
  minType?: number;
}

export interface NavSection {
  id: string;
  /** Eyebrow da seção na sidebar; omitido pra seção principal. */
  label?: string;
  minType?: number;
  items: NavItem[];
}

/** Sidebar em seções rotuladas (padrão Linear/Vercel) no lugar do grupo
 * colapsável — admin enxerga tudo de uma vez, sem clique extra. */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "plataforma",
    items: [
      { to: "/", label: "Painel", icon: LayoutDashboard },
      { to: "/marketplace", label: "Marketplace", icon: Store, minType: UserType.PROFESSOR },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    minType: UserType.ADMIN,
    items: [
      { to: "/admin/universidades", label: "Instituições", icon: Building2 },
      { to: "/admin/cursos", label: "Disciplinas", icon: BookOpen },
      { to: "/admin/oferecimentos", label: "Oferecimentos", icon: GraduationCap },
      { to: "/admin/usuarios", label: "Usuários", icon: Users },
      { to: "/admin/arquivos", label: "Tipos de arquivo", icon: FileCog },
      { to: "/admin/mensagens", label: "Mensagens", icon: MessageSquare },
      { to: "/admin/logs", label: "Logs", icon: ScrollText },
      { to: "/admin/pipeline", label: "Pipeline", icon: Workflow },
      { to: "/admin/banco", label: "Banco de dados", icon: Database },
      { to: "/admin/documentacao", label: "Documentação", icon: BookMarked },
    ],
  },
];

export function visibleNavSections(userType: number | undefined): NavSection[] {
  const type = userType ?? -1;
  return NAV_SECTIONS.filter((s) => s.minType === undefined || type >= s.minType)
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => item.minType === undefined || type >= item.minType),
    }))
    .filter((s) => s.items.length > 0);
}

/** Itens do bottom nav mobile — só o nível principal; admin entra como
 * um atalho pra primeira rota da seção. */
export function mobileNavItems(userType: number | undefined): NavItem[] {
  const sections = visibleNavSections(userType);
  const items: NavItem[] = [];
  for (const section of sections) {
    if (section.id === "admin") {
      items.push({ to: section.items[0].to, label: "Admin", icon: section.items[0].icon });
    } else {
      items.push(...section.items);
    }
  }
  return items;
}
