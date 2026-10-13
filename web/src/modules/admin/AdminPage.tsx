import { useState } from "react";
import { Tabs, tabButtonId, tabPanelId } from "@runcodes/ui";
import { UniversitiesTab } from "./components/UniversitiesTab";
import { AllowedFilesTab } from "./components/AllowedFilesTab";
import { AdminUsersTab } from "./components/AdminUsersTab";
import { LogsTab } from "./components/LogsTab";

type TabKey = "universidades" | "arquivos" | "usuarios" | "logs";

export function AdminPage() {
  const [tab, setTab] = useState<TabKey>("universidades");

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">Admin</h1>

      <Tabs
        layoutId="admin-tabs"
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "universidades", label: "Instituições" },
          { key: "arquivos", label: "Tipos de arquivo" },
          { key: "usuarios", label: "Usuários" },
          { key: "logs", label: "Logs" },
        ]}
      />

      <div role="tabpanel" id={tabPanelId("admin-tabs", tab)} aria-labelledby={tabButtonId("admin-tabs", tab)}>
        {tab === "universidades" && <UniversitiesTab />}
        {tab === "arquivos" && <AllowedFilesTab />}
        {tab === "usuarios" && <AdminUsersTab />}
        {tab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}
