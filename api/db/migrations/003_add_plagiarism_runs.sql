-- Plagiarism detection runs. One row per (exercise, provider) comparison
-- job. Async by nature (JPlag/Dolos comparisons take seconds to minutes,
-- not a request/response cycle) — a worker process picks up `queued` rows
-- off a Redis-backed job queue, not this table directly; the table is
-- just the durable record of what was asked for and what came back.
-- See runcodes-docs: roadmap/plagiarism-detection.md.

CREATE TABLE plagiarism_runs (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('dolos', 'jplag')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    requested_by VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX idx_plagiarism_runs_exercise_id ON plagiarism_runs(exercise_id);

-- base.sql's tables are all owned by the `runcodes` app role, not
-- whichever superuser runs migrations — match that, or Prisma's
-- introspection silently can't see the table's columns.
ALTER TABLE plagiarism_runs OWNER TO runcodes;
GRANT ALL ON plagiarism_runs TO runcodes;
GRANT USAGE, SELECT ON SEQUENCE plagiarism_runs_id_seq TO runcodes;
