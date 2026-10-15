import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOffering, getOfferingInfographic, gradesExportCsvUrl } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";
import { Link } from "react-router-dom";
import { Check, Copy, PieChart, Star, Users } from "lucide-react";
import { Button, EmptyState, PageContainer, PageHeader, Skeleton, StatCard, Tabs, tabButtonId, tabPanelId } from "@runcodes/ui";
import { isOfferingStaff } from "@runcodes/shared";
import { MembersTab } from "./components/MembersTab";
import { ExercisesTab } from "./components/ExercisesTab";
import { GradesTab } from "./components/GradesTab";

type TabKey = "exercicios" | "membros" | "notas";

function EnrollmentCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="mb-6 flex w-fit items-center gap-5 rounded-xl bg-accent px-5 py-3 text-left text-accent-foreground shadow-card transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Código de matrícula</p>
        <p className="font-mono text-2xl font-bold leading-tight">{code}</p>
      </div>
      <span className="flex items-center gap-1.5 text-xs font-medium" aria-live="polite">
        {copied ? (
          <>
            <Check aria-hidden className="size-4" />
            Copiado!
          </>
        ) : (
          <>
            <Copy aria-hidden className="size-4 opacity-80" />
            <span className="sr-only">Copiar código de matrícula</span>
          </>
        )}
      </span>
    </button>
  );
}

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

  const infographicQuery = useQuery({
    queryKey: ["offering", offeringId, "infographic"],
    queryFn: () => getOfferingInfographic(offeringId),
    enabled: Number.isInteger(offeringId),
  });

  if (query.isLoading) {
    return (
      <PageContainer width="wide" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
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
    <PageContainer width="wide">
      <PageHeader
        title={offering.course?.title ?? `Turma #${offering.id}`}
        crumbs={[
          { label: "Painel", to: "/" },
          { label: offering.course?.title ?? `Turma #${offering.id}` },
        ]}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <a href={gradesExportCsvUrl(offering.id)} download>
                Exportar notas (CSV)
              </a>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/turmas/${offering.id}/editar`}>Editar turma</Link>
            </Button>
          </>
        }
      />

      {offering.enrollmentCode && <EnrollmentCodeBlock code={offering.enrollmentCode} />}

      {infographicQuery.isLoading ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-[72px] w-full rounded-xl" />
          <Skeleton className="h-[72px] w-full rounded-xl" />
          <Skeleton className="h-[72px] w-full rounded-xl" />
        </div>
      ) : infographicQuery.data ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            variant="filled"
            color="slate"
            icon={<Users aria-hidden />}
            label="Alunos"
            value={infographicQuery.data.studentCount}
          />
          <StatCard
            variant="filled"
            color="primary"
            icon={<PieChart aria-hidden />}
            label="Notas ≥ 5.0"
            value={`${infographicQuery.data.gradesAbove5Percent}%`}
          />
          <StatCard
            variant="filled"
            color="accent"
            icon={<Star aria-hidden />}
            label="Média global"
            value={infographicQuery.data.gradesAverage.toFixed(1)}
          />
        </div>
      ) : null}

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

      <div role="tabpanel" id={tabPanelId("offering-manage-tabs", tab)} aria-labelledby={tabButtonId("offering-manage-tabs", tab)}>
        {tab === "exercicios" && <ExercisesTab offering={offering} />}
        {tab === "membros" && <MembersTab offering={offering} currentUserType={user?.type ?? 0} />}
        {tab === "notas" && <GradesTab offeringId={offering.id} />}
      </div>
    </PageContainer>
  );
}
