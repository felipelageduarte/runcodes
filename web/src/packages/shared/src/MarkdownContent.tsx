import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/** Enunciado de exercício (e, na Fase 4, preview do marketplace) é
 * conteúdo escrito por outro usuário — sempre sanitizado antes de virar
 * HTML, nunca `dangerouslySetInnerHTML` direto. Ver
 * docs/frontend/security.md#xss-via-conteúdo-gerado-por-usuário. */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-blockquote:text-muted-foreground prose-li:text-foreground prose-p:text-foreground prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-pre:text-foreground [&_a]:text-primary-600 [&_code]:text-foreground [&_pre_code]:text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
