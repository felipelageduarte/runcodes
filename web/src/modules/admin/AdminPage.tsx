import { Outlet, useLocation } from "react-router-dom";
import { PageContainer, PageHeader } from "@runcodes/ui";

const SECTION_TITLES: Record<string, string> = {
  "": "Visão geral",
  universidades: "Instituições",
  cursos: "Disciplinas",
  oferecimentos: "Oferecimentos",
  arquivos: "Tipos de arquivo",
  usuarios: "Usuários",
  auditoria: "Auditoria",
  logs: "Logs (legado)",
  mensagens: "Mensagens",
  pipeline: "Pipeline",
  banco: "Banco de dados",
  documentacao: "Documentação",
  tickets: "Tickets",
  avisos: "Avisos",
};

export function AdminPage() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[2] ?? "";
  const title = SECTION_TITLES[section] ?? "Admin";

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="Administração" title={title} />
      <Outlet />
    </PageContainer>
  );
}
