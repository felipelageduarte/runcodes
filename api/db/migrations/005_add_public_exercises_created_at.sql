-- Marketplace needs to sort "mais recente" (docs/frontend/marketplace.md
-- gap #2) and public_exercises never recorded when a listing was made.
-- Backfill existing rows to now() — no real publish date is recoverable
-- for them, "just published" is the least-wrong default (puts them at
-- the back of a "recent first" sort once new publishes start landing).

ALTER TABLE public_exercises ADD COLUMN created_at timestamp without time zone NOT NULL DEFAULT now();
