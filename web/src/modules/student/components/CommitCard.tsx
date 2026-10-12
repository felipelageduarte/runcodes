import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCommitCases, type CommitRecord } from "@runcodes/api-client";
import { Badge, Card } from "@runcodes/ui";
import { commitStatusLabel, formatDateTime, isCommitInProgress } from "@runcodes/shared";
import { CommitCasesList } from "./CommitCasesList";

export function CommitCard({ commit, defaultOpen = false }: { commit: CommitRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const inProgress = isCommitInProgress(commit.status);

  const casesQuery = useQuery({
    queryKey: ["commit-cases", commit.id],
    queryFn: () => getCommitCases(commit.id),
    enabled: open,
    refetchInterval: open && inProgress ? 2000 : false,
  });

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="text-sm text-muted-foreground">{formatDateTime(commit.commitTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          {commit.score !== null && (
            <span className="text-sm font-medium text-foreground">Nota: {commit.score}</span>
          )}
          <Badge variant={inProgress ? "info" : "neutral"}>{commitStatusLabel(commit.status)}</Badge>
        </div>
      </button>
      {open && (
        <div className="border-t border-border">
          {casesQuery.data ? <CommitCasesList cases={casesQuery.data} /> : null}
        </div>
      )}
    </Card>
  );
}
