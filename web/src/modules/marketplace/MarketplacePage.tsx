import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { listUniversities, searchMarketplace, type MarketplaceSortBy } from "@runcodes/api-client";
import {
  Button,
  EmptyState,
  Input,
  PageContainer,
  PageHeader,
  Skeleton,
  StaggerItem,
  StaggerList,
} from "@runcodes/ui";
import { ExerciseCard } from "./components/ExerciseCard";

const PAGE_SIZE = 12;

const sortOptions: { value: MarketplaceSortBy; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome" },
  { value: "popularity", label: "Mais adotados" },
  { value: "difficulty", label: "Dificuldade" },
];

export function MarketplacePage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [universityId, setUniversityId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<MarketplaceSortBy>("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities });

  const resultsQuery = useQuery({
    queryKey: ["marketplace", "search", { search, language, universityId, sortBy, page }],
    queryFn: () =>
      searchMarketplace({ search: search || undefined, language: language || undefined, universityId, sortBy, page, pageSize: PAGE_SIZE }),
  });

  const totalPages = resultsQuery.data ? Math.ceil(resultsQuery.data.total / PAGE_SIZE) : 1;

  return (
    <PageContainer width="wide">
      <PageHeader title="Marketplace" />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Buscar por título ou palavra-chave..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Qualquer linguagem</option>
          <option value="py">Python</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={universityId ?? ""}
          onChange={(e) => {
            setUniversityId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
        >
          <option value="">Qualquer instituição</option>
          {(universitiesQuery.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.abbreviation}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as MarketplaceSortBy);
            setPage(1);
          }}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {resultsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : resultsQuery.isError ? (
        <EmptyState title="Não foi possível carregar o marketplace" />
      ) : !resultsQuery.data || resultsQuery.data.entries.length === 0 ? (
        <EmptyState
          icon={<Store className="size-8" />}
          title="Nenhum exercício encontrado"
          description="Tente outro termo de busca ou remova os filtros."
        />
      ) : (
        <>
          <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resultsQuery.data.entries.map((exercise) => (
              <StaggerItem key={exercise.exerciseId}>
                <ExerciseCard exercise={exercise} />
              </StaggerItem>
            ))}
          </StaggerList>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
