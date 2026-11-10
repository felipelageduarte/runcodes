import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { DbAdminService } from "../../services/db-admin.service.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

// O limite real (com código de erro próprio) é do service; este só impede
// que um corpo absurdo chegue até lá.
const querySchema = z.object({
  sql: z.string().min(1).max(200_000),
  confirm: z.boolean().optional().default(false),
  password: z.string().min(1).max(200).optional(),
});

/** Saúde e schema (ERD) são leitura de catálogo: ADMIN (`admin.db:read`).
 * O console que executa SQL é só DEVELOPER (`admin.db:query`). */
export function createDbAdminRouter(dbAdminService: DbAdminService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth);
  const canRead = requirePermission("admin.db:read");
  const canQuery = requirePermission("admin.db:query");

  router.get("/health", canRead, async (_req, res, next) => {
    try {
      res.json(await dbAdminService.health());
    } catch (err) {
      next(err);
    }
  });

  router.get("/schema", canRead, async (_req, res, next) => {
    try {
      res.json(await dbAdminService.schema());
    } catch (err) {
      next(err);
    }
  });

  router.get("/console", canQuery, (_req, res) => {
    res.json(dbAdminService.consoleInfo());
  });

  router.post("/query", canQuery, async (req: AuthedRequest, res, next) => {
    try {
      const input = querySchema.parse(req.body);
      const user = req.user!;
      const viewingAs = user.realType !== undefined && user.realType !== user.type;
      const userAgent = req.headers["user-agent"];
      const requestId = res.getHeader("X-Request-Id");
      res.json(
        await dbAdminService.runQuery(input, {
          email: user.email,
          type: user.realType ?? user.type,
          viewAsType: viewingAs ? user.type : null,
          ip: req.ip ?? null,
          userAgent: typeof userAgent === "string" ? userAgent.slice(0, 1000) : null,
          requestId: typeof requestId === "string" ? requestId : null,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
