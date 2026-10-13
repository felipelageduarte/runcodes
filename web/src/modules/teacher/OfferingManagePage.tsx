import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOffering } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";
import { EmptyState, Skeleton, Tabs } from "@runcodes/ui";
import { isOfferingStaff } from "@runcodes/shared";
import { MembersTab } from "./components/MembersTab";
import { ExercisesTab } from "./components/ExercisesTab";
import { GradesTab } from "./components/GradesTab";

type TabKey = "exercicios" | "membros" | "notas";

export function OfferingManagePage() {
  const { id } = useParams<{ id: string }>();
  const offeringId = Number(id);
  const [tab, setTab] = useState<TabKey>("exercicios");
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["offering", offeringId],
    queryFn: () => getOffering(offeringId),
    enabled: Number.isInteger(offeringId),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-2 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <EmptyState title="Não foi possível carregar essa turma" />
      </div>
    );
  }

  const offering = query.data;
  const isAdmin = (user?.type ?? -1) >= UserType.ADMIN;
  const canManage = isAdmin || isOfferingStaff(offering, user?.email);

  if (!canManage) {
    return (
      <div className="p-6">
        <EmptyState title="Você não tem permissão pra gerenciar essa turma" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">{offering.course?.title ?? `Turma #${offering.id}`}</h1>
      <p className="mb-4 text-sm text-muted-foreground">Código de matrícula: {offering.enrollmentCode ?? "—"}</p>

      <Tabs
        layoutId="offering-manage-tabs"
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "exercicios", label: "Exercícios" },
          { key: "membros", label: "Membros" },
          { key: "notas", label: "Notas" },
        ]}
      />

      {tab === "exercicios" && <ExercisesTab offering={offering} />}
      {tab === "membros" && <MembersTab offering={offering} currentUserType={user?.type ?? 0} />}
      {tab === "notas" && <GradesTab offeringId={offering.id} />}
    </div>
  );
}
