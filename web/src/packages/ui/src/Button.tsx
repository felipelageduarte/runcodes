import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "./lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-700",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-danger text-danger-foreground hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

// motion.button's drag-gesture props (onDrag/onDragStart/onDragEnd) have a
// different signature than the native DOM drag-event handlers of the same
// name — nobody actually drags a Button, drop the native ones so the two
// don't collide when we spread onto motion.button below.
type NativeEventsThatCollideWithMotion =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, NativeEventsThatCollideWithMotion>,
    VariantProps<typeof buttonVariants> {
  /** Render as a different element (e.g. a router `<Link>`) while keeping the button's visuals. */
  asChild?: boolean;
  /** Shows a spinner and disables the button — for submit buttons during a mutation. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    // asChild (Radix Slot) requires exactly one element child — `loading`/
    // `disabled` only make sense for an actual <button> (asChild is for
    // passing visuals onto a <Link>/<a>, never a pending-mutation
    // trigger), so skip the spinner wrapper and the disabled prop
    // entirely in that branch instead of conditionally rendering it.
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.1 }}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </motion.button>
    );
  },
);
Button.displayName = "Button";
