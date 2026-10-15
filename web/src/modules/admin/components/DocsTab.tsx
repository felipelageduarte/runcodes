import { ExternalLink } from "lucide-react";
import { Button } from "@runcodes/ui";

/** Documentação técnica/operacional embutida no painel — o site
 * Docusaurus (runcodes-docs) é servido pela API em /docs, e a seção
 * /docs/admin-docs exige a sessão de admin (cookie httpOnly, que o
 * iframe same-origin envia sozinho). O manual público do usuário vive
 * em /docs/manual e tem link próprio na topbar pra todo mundo. */
export function DocsTab() {
  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col gap-2">
      <div className="flex shrink-0 justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a href="/docs/admin-docs/" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Abrir em nova aba
          </a>
        </Button>
      </div>
      <iframe
        src="/docs/admin-docs/"
        title="Documentação de administração"
        className="min-h-0 w-full flex-1 rounded-md border border-border bg-background"
      />
    </div>
  );
}
