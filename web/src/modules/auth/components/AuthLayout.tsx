import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@runcodes/ui";

/** Moldura das telas de auth — marca em display font acima do card,
 * fundo com um glow sutil do primary pra tela não nascer morta. */
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary-500/10 blur-3xl"
      />
      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="mb-5 text-center font-display text-2xl font-bold tracking-tight text-foreground">
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
  );
}
