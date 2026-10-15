import type { HTMLAttributes } from "react";
import { cn } from "./lib/cn";

/** Always shaped like the content it replaces — never a generic centered
 * spinner (see docs/frontend/design-system.md). Compose with width/height
 * utility classes at the call site. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
      {...props}
    />
  );
}
