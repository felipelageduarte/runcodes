import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

// Sidebar da documentação de administração/técnica (rota /admin-docs).
const sidebars: SidebarsConfig = {
  adminSidebar: [
    "index",
    {
      type: "category",
      label: "Arquitetura",
      collapsed: false,
      items: [
        "architecture/overview",
        "architecture/componentes",
        "architecture/contratos",
        "architecture/migration-strategy",
      ],
    },
    {
      type: "category",
      label: "Operação",
      collapsed: false,
      items: [
        "operacao/pipeline",
        "operacao/banco-de-dados",
        "operacao/logs-e-auditoria",
        "operacao/deploy",
      ],
    },
    {
      type: "category",
      label: "Gestão da plataforma",
      items: ["gestao/instituicoes-e-usuarios", "gestao/tipos-de-arquivo"],
    },
    "troubleshooting",
    {
      type: "category",
      label: "Backend (runcodes-api)",
      items: [
        "backend/overview",
        "backend/auth",
        "backend/users",
        "backend/courses-offerings-exercises",
        "backend/exercise-management",
        "backend/enrollments",
        "backend/commits",
        "backend/admin-and-support",
        "backend/testing",
      ],
    },
    {
      type: "category",
      label: "Frontend (runcodes-web)",
      items: [
        "frontend/overview",
        "frontend/design-system",
        "frontend/journeys",
        "frontend/code-editor",
        "frontend/marketplace",
        "frontend/security",
        "frontend/testing",
        "frontend/roadmap",
      ],
    },
    {
      type: "category",
      label: "Roadmap",
      items: [
        "roadmap/gap-audit-2026-10",
        "roadmap/backlog",
        "roadmap/plagiarism-detection",
      ],
    },
  ],
};

export default sidebars;
