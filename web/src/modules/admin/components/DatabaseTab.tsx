import { useState } from "react";
import { Tabs, tabButtonId, tabPanelId } from "@runcodes/ui";
import { DbHealthPanel } from "./DbHealthPanel";
import { SqlConsole } from "./SqlConsole";
import { ErdView } from "./ErdView";

type SubTab = "saude" | "query" | "diagrama";

export function DatabaseTab() {
  const [tab, setTab] = useState<SubTab>("saude");

  return (
    <div className="py-4">
      <Tabs
        layoutId="db-tabs"
        active={tab}
        onChange={(k) => setTab(k as SubTab)}
        tabs={[
          { key: "saude", label: "Saúde" },
          { key: "query", label: "SQL Query" },
          { key: "diagrama", label: "Diagrama" },
        ]}
      />
      <div role="tabpanel" id={tabPanelId("db-tabs", tab)} aria-labelledby={tabButtonId("db-tabs", tab)}>
        {tab === "saude" && <DbHealthPanel />}
        {tab === "query" && <SqlConsole />}
        {tab === "diagrama" && <ErdView />}
      </div>
    </div>
  );
}
