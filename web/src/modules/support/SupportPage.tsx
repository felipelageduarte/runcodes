import { useState } from "react";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";
import { Tabs } from "@runcodes/ui";
import { MyTicketsTab } from "./components/MyTicketsTab";
import { TicketQueueTab } from "./components/TicketQueueTab";
import { AlertsTab } from "./components/AlertsTab";
import { FaqTab } from "./components/FaqTab";

type TabKey = "meus" | "fila" | "avisos" | "faq";

export function SupportPage() {
  const { user } = useSession();
  const isStaff = (user?.type ?? -1) >= UserType.ASSISTANT;
  const [tab, setTab] = useState<TabKey>("meus");

  const tabs = [
    { key: "meus" as const, label: "Meus tickets" },
    ...(isStaff ? [{ key: "fila" as const, label: "Fila" }, { key: "avisos" as const, label: "Avisos" }] : []),
    { key: "faq" as const, label: "FAQ" },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">Suporte</h1>

      <Tabs layoutId="support-tabs" active={tab} onChange={(k) => setTab(k as TabKey)} tabs={tabs} />

      {tab === "meus" && <MyTicketsTab />}
      {tab === "fila" && isStaff && <TicketQueueTab />}
      {tab === "avisos" && isStaff && <AlertsTab />}
      {tab === "faq" && <FaqTab />}
    </div>
  );
}
