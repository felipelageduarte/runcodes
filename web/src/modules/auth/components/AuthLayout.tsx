import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@runcodes/ui";
import loginBg from "../../../assets/login_bg.jpg";

const LANGUAGES = ["C/C++", "Python", "Java", "Haskell", "Go"];

/** Moldura das telas de auth — split-screen herdado do legado: a foto
 * aérea do ICMC à esquerda com o pitch do produto, formulário à
 * direita. No mobile só a coluna do form, com a marca em cima. */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Painel de marca — foto do campus com véu slate, como o login
          original. Some abaixo de lg. */}
      <div
        className="relative hidden flex-1 overflow-hidden bg-sidebar bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-[oklch(0.25_0.04_252)]/75" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex h-full flex-col justify-center gap-6 px-12 xl:px-20"
        >
          <p className="font-display text-5xl font-bold tracking-tight text-white">
            run<span className="text-accent">.</span>codes
          </p>
          <p className="max-w-xl text-lg leading-relaxed text-white/85">
            Sistema de submissão e correção automática de exercícios de programação — seu código
            compilado, executado e avaliado contra os casos de teste do professor, em segundos.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <span
                key={lang}
                className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1 font-mono text-sm text-white/90"
              >
                {lang}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Coluna do formulário */}
      <div className="flex w-full items-center justify-center p-4 lg:w-[30rem] lg:shrink-0 xl:w-[34rem]">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-5 text-center font-display text-2xl font-bold tracking-tight text-foreground lg:hidden">
            run<span className="text-accent">.</span>codes
          </p>
          <Card className="shadow-popover">
            <CardHeader>
              <CardTitle className="font-display">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
