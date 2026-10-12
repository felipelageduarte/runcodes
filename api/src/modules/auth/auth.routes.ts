import { Router } from "express";
import { z } from "zod";
import { login, InvalidCredentialsError } from "./auth.service.js";

export const authRouter = Router();

// Not .email(): legacy rows (e.g. "admin@admin") predate strict validation
// and still need to log in. Format is enforced on signup/profile update, not here.
const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "invalid_body", details: err.issues });
    }
    next(err);
  }
});
