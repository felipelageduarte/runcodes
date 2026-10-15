import { useQuery } from "@tanstack/react-query";
import { getGrades } from "@runcodes/api-client";
import { EmptyState, Skeleton, Table, type TableColumn } from "@runcodes/ui";

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
      <Table columns={columns} rows={rows} rowKey={(r) => r.email} density="compact" stickyFirstColumn emptyTitle="Nenhum aluno matriculado" />
    </div>
  );
}
