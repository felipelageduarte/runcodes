import path from "node:path";
import fs from "node:fs";
import express, { Router, type RequestHandler } from "express";
import { UserType } from "../../lib/constants.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

/** Serve o site de documentação (build do runcodes-docs, Docusaurus com
 * baseUrl /docs/). Duas políticas no mesmo build:
 *   - /docs/manual/** e assets: públicos — é o manual do usuário.
 *   - /docs/admin-docs/**: só admin autenticado (cookie httpOnly da
 *     sessão, então funciona dentro de iframe do painel).
 * Limitação conhecida: os chunks JS do Docusaurus são compartilhados
 * entre as duas seções, então o conteúdo admin não é segredo forte —
 * é documentação operacional, não credencial. Isolamento real exigiria
 * dois builds separados. */
export function createDocsRouter(distDir: string, requireAuth: RequestHandler) {
  const router = Router();
  const root = path.resolve(distDir);
  const available = fs.existsSync(path.join(root, "index.html"));

  // O helmet global aplica uma CSP pensada pra API JSON; o site Docusaurus
  // tem scripts/estilos próprios que ela bloquearia.
  router.use((_req, res, next) => {
    res.removeHeader("Content-Security-Policy");
    next();
  });

  router.use("/admin-docs", requireAuth, ((req: AuthedRequest, res, next) => {
    if ((req.user?.type ?? -1) < UserType.ADMIN) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  }) as RequestHandler);

  if (available) {
    router.use(express.static(root, { index: "index.html" }));
  } else {
    router.use((_req, res) => {
      res
        .status(503)
        .json({ error: "docs_not_built", hint: "rode `npm run build` no runcodes-docs (DOCS_DIST_DIR)" });
    });
  }

  return router;
}
