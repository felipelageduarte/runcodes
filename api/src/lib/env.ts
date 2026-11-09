import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  // JWT curto; o cookie de sessão dura 7 dias e POST /api/auth/refresh
  // renova o token enquanto `tv` bater com o banco (spec F2, Q4).
  JWT_EXPIRES_IN: z.string().default("1h"),
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
  // Origens extras aceitas no CORS e na checagem anti-CSRF de `Origin`
  // (lista separada por vírgula); APP_BASE_URL entra sempre.
  APP_ALLOWED_ORIGINS: z.string().default(""),
  // Transição F0/F2: enquanto o front em produção não manda
  // `X-Requested-With: runcodes-web`, só a checagem de `Origin` barra CSRF.
  // Virar `true` (e depois remover a flag) assim que a F0 estiver na main.
  CSRF_REQUIRE_HEADER: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Build estático do runcodes-docs (Docusaurus, baseUrl /docs/) — servido
  // pela própria API em /docs: o manual é público, /docs/admin-docs exige
  // sessão de admin (o cookie httpOnly já autentica o iframe do painel).
  DOCS_DIST_DIR: z.string().default("../runcodes-docs/build"),
});

export const env = schema.parse(process.env);
