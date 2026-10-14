import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AdminUserService } from "../../services/admin-user.service.js";
import { requireMinType } from "../middleware/requireMinType.js";
import { UserType } from "../../lib/constants.js";
import type { AuthedRequest } from "../middleware/requireAuth.js";

const listQuerySchema = z.object({
  universityId: z.coerce.number().int().optional(),
  type: z.coerce.number().int().optional(),
  confirmed: z.coerce.boolean().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.number().int().min(0).max(4).optional(),
  confirmed: z.boolean().optional(),
  universityId: z.number().int().nullable().optional(),
});

const deleteSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória"),
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  type: z.number().int().min(0).max(4).default(0),
  universityId: z.number().int().nullable().default(null),
});

/** Admin-only account management — mirrors UsersController::index/view/edit. */
export function createAdminUsersRouter(adminUserService: AdminUserService, requireAuth: RequestHandler) {
  const router = Router();
  router.use(requireAuth, requireMinType(UserType.ADMIN));

  router.get("/", async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      res.json(
        await adminUserService.list({
          universityId: q.universityId,
          type: q.type,
          confirmed: q.confirmed,
          nameContains: q.name,
          emailContains: q.email,
          page: q.page,
          pageSize: q.pageSize,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const input = createSchema.parse(req.body);
      res.status(201).json(await adminUserService.create(input));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:email", async (req, res, next) => {
    try {
      res.json(await adminUserService.getByEmail(req.params.email));
    } catch (err) {
      next(err);
    }
  });

  router.put("/:email", async (req, res, next) => {
    try {
      const input = updateSchema.parse(req.body);
      res.json(await adminUserService.update(req.params.email, input));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:email", async (req: AuthedRequest, res, next) => {
    try {
      const { password } = deleteSchema.parse(req.body);
      await adminUserService.delete(req.params.email, req.user!.email, password);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
