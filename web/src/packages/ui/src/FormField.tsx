import type { ReactNode } from "react";
import { Label } from "./Label";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}

/** Thin adapter between the design system's field primitives and
 * React Hook Form — the form hook owns validation state, this just
 * renders it consistently (label, field, error message) everywhere. */
export function FormField({ label, htmlFor, error, children, hint }: FormFieldProps) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
