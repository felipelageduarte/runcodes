import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  LEGACY_PASSWORD_SALT: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().default("sa-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_PREFIX: z.string().default("runcodes"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JPLAG_JAR_PATH: z.string().default("vendor/jplag/jplag.jar"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(2525),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("run.codes <no-reply@run.codes>"),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  // Build estático do runcodes-docs (Docusaurus, baseUrl /docs/) — servido
  // pela própria API em /docs: o manual é público, /docs/admin-docs exige
  // sessão de admin (o cookie httpOnly já autentica o iframe do painel).
  DOCS_DIST_DIR: z.string().default("../runcodes-docs/build"),
});

export const env = schema.parse(process.env);
