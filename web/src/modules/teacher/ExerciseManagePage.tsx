import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExercise, getOffering } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";
import { EmptyState, Skeleton, Tabs } from "@runcodes/ui";
import { isOfferingStaff } from "./lib/offeringRole";
import { CasesTab } from "./components/CasesTab";
import { StatsTab } from "./components/StatsTab";
import { PlagiarismTab } from "./components/PlagiarismTab";
import { AttachmentsTab } from "./components/AttachmentsTab";

type TabKey = "casos" | "anexos" | "stats" | "plagio";

const NOT_COMPILABLE_TYPE = 1;

export function ExerciseManagePage() {
  const { id } = useParams<{ id: string }>();
  const exerciseId = Number(id);
  const [tab, setTab] = useState<TabKey>("casos");
  const { user } = useSession();

  const exerciseQuery = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => getExercise(exerciseId),
    enabled: Number.isInteger(exerciseId),
  });

  const offeringQuery = useQuery({
    queryKey: ["offering", exerciseQuery.data?.offeringId],
    queryFn: () => getOffering(exerciseQuery.data!.offeringId),
    enabled: Boolean(exerciseQuery.data),
  });

  if (exerciseQuery.isLoading || (exerciseQuery.data && offeringQuery.isLoading)) {
    return (
      <div className="mx-auto max-w-4xl space-y-2 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (exerciseQuery.isError || !exerciseQuery.data || offeringQuery.isError || !offeringQuery.data) {
    return (
      <div className="p-6">
        <EmptyState title="Não foi possível carregar esse exercício" />
      </div>
    );
  }

  const exercise = exerciseQuery.data;
  const offering = offeringQuery.data;
  const isAdmin = (user?.type ?? -1) >= UserType.ADMIN;
  const canManage = isAdmin || isOfferingStaff(offering, user?.email);

  if (!canManage) {
    return (
      <div className="p-6">
        <EmptyState title="Você não tem permissão pra gerenciar esse exercício" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to={`/turmas/${offering.id}/gerenciar`} className="text-sm text-muted-foreground hover:underline">
        ← {offering.course?.title ?? `Turma #${offering.id}`}
      </Link>
      <h1 className="mb-4 mt-1 text-2xl font-semibold text-foreground">{exercise.title}</h1>

      <Tabs
        layoutId="exercise-manage-tabs"
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "casos", label: "Casos de teste" },
          { key: "anexos", label: "Anexos" },
          { key: "stats", label: "Estatísticas" },
          { key: "plagio", label: "Plágio" },
        ]}
      />

      {tab === "casos" && <CasesTab exerciseId={exercise.id} notCompilable={exercise.type === NOT_COMPILABLE_TYPE} />}
      {tab === "anexos" && <AttachmentsTab exerciseId={exercise.id} />}
      {tab === "stats" && <StatsTab exerciseId={exercise.id} />}
      {tab === "plagio" && <PlagiarismTab exerciseId={exercise.id} />}
    </div>
  );
}
