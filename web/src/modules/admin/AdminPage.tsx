import { Outlet, useLocation } from "react-router-dom";
import { PageContainer, PageHeader } from "@runcodes/ui";
import { PlatformActivityPanel } from "./components/PlatformActivityPanel";

const SECTION_TITLES: Record<string, string> = {
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
};

export function AdminPage() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[2] ?? "";
  const title = SECTION_TITLES[section] ?? "Admin";

  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="Administração" title={title} />
      <div className="mb-6">
        <PlatformActivityPanel />
      </div>
      <Outlet />
    </PageContainer>
  );
}
