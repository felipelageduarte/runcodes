import { useQuery } from "@tanstack/react-query";
import { getGrades, getOfferingInfographic, gradesExportCsvUrl } from "@runcodes/api-client";
import { Card, CardContent, EmptyState, Skeleton, Table, type TableColumn } from "@runcodes/ui";

interface GradeRow {
  email: string;
  name: string;
  identifier: string | null;
  scores: Record<number, string | null>;
}

export function GradesTab({ offeringId }: { offeringId: number }) {
  const gradesQuery = useQuery({
    queryKey: ["offering", offeringId, "grades"],
    queryFn: () => getGrades(offeringId),
  });
  const infographicQuery = useQuery({
    queryKey: ["offering", offeringId, "infographic"],
    queryFn: () => getOfferingInfographic(offeringId),
  });

  if (gradesQuery.isLoading) {
    return (
      <div className="space-y-2 py-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!gradesQuery.data) {
    return <EmptyState title="Não foi possível carregar as notas" />;
  }

  const { students, exercises } = gradesQuery.data;

  const rows: GradeRow[] = students.map((student) => ({
    ...student,
    scores: Object.fromEntries(
      exercises.map((ex) => [ex.exerciseId, ex.grades.find((g) => g.studentEmail === student.email)?.score ?? null]),
    ),
  }));

  const columns: TableColumn<GradeRow>[] = [
    { key: "name", header: "Aluno", render: (r) => r.name },
    ...exercises.map(
      (ex): TableColumn<GradeRow> => ({
        key: `ex-${ex.exerciseId}`,
        header: ex.title,
        align: "center",
        render: (r) => r.scores[ex.exerciseId] ?? "—",
      }),
    ),
  ];

  return (
    <div className="space-y-4 py-4">
      {infographicQuery.data && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-foreground">{infographicQuery.data.studentCount}</p>
              <p className="text-xs text-muted-foreground">Alunos matriculados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-foreground">{infographicQuery.data.gradesAbove5Percent}%</p>
              <p className="text-xs text-muted-foreground">Notas acima de 5</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-foreground">{infographicQuery.data.gradesAverage.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Média da turma</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <a
          href={gradesExportCsvUrl(offeringId)}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          Exportar CSV
        </a>
      </div>

      <Table columns={columns} rows={rows} rowKey={(r) => r.email} density="compact" emptyTitle="Nenhum aluno matriculado" />
    </div>
  );
}
