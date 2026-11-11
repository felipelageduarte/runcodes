import {
  LayoutDashboard,
  Store,
  Building2,
  BookOpen,
  BookMarked,
  FileCog,
  Users,
  ScrollText,
  ShieldCheck,
  MessageSquare,
  Workflow,
  Database,
  GraduationCap,
  Gauge,
  LifeBuoy,
  Megaphone,
} from "lucide-react";
import { UserType, minTypeFor, type AdminPermission } from "@runcodes/shared";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Omit for "any authenticated user". */
  minType?: number;
  /** Permissão do catálogo (`@runcodes/shared` adminPermissions) que a
   * tela exige na API; o nível mínimo vem de lá, não de um número solto.
   * Item da seção admin sem permissão (tela cuja API faz gate por papel no
   * service, como tickets e avisos) declara `minType` explícito. */
  permission?: AdminPermission;
  /** Ativo só na rota exata (NavLink `end`) — pra item pai como /admin,
   * que senão acende junto com toda sub-rota. */
  end?: boolean;
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
      { to: "/admin", label: "Visão geral", icon: Gauge, end: true, permission: "admin.overview:read" },
      { to: "/admin/universidades", label: "Instituições", icon: Building2, permission: "admin.universities:manage" },
      { to: "/admin/cursos", label: "Disciplinas", icon: BookOpen, permission: "admin.courses:manage" },
      { to: "/admin/oferecimentos", label: "Oferecimentos", icon: GraduationCap, permission: "admin.courses:manage" },
      { to: "/admin/usuarios", label: "Usuários", icon: Users, permission: "admin.users:manage" },
      { to: "/admin/arquivos", label: "Tipos de arquivo", icon: FileCog, permission: "admin.allowed-files:manage" },
      { to: "/admin/tickets", label: "Tickets", icon: LifeBuoy, minType: UserType.ADMIN },
      { to: "/admin/avisos", label: "Avisos", icon: Megaphone, minType: UserType.ADMIN },
      { to: "/admin/mensagens", label: "Mensagens", icon: MessageSquare, permission: "admin.messages:manage" },
      { to: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck, permission: "admin.audit:read" },
      { to: "/admin/logs", label: "Logs (legado)", icon: ScrollText, permission: "admin.logs:read" },
      { to: "/admin/pipeline", label: "Pipeline", icon: Workflow, permission: "admin.pipeline:manage" },
      { to: "/admin/banco", label: "Banco de dados", icon: Database, permission: "admin.db:read" },
      { to: "/admin/documentacao", label: "Documentação", icon: BookMarked, permission: "admin.docs:read" },
    ],
  },
];

/** Nível mínimo de um item: o declarado, senão o da permissão do catálogo. */
export function navItemMinType(item: NavItem): number | undefined {
  if (item.minType !== undefined) return item.minType;
  if (item.permission !== undefined) return minTypeFor(item.permission);
  return undefined;
}

export function visibleNavSections(userType: number | undefined): NavSection[] {
  const type = userType ?? -1;
  return NAV_SECTIONS.filter((s) => s.minType === undefined || type >= s.minType)
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        const min = navItemMinType(item);
        return min === undefined || type >= min;
      }),
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
