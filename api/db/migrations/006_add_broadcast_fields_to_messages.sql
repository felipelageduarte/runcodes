-- The legacy `messages` table only ever recorded the broadcast content
-- (recipes/subject/message), never who sent it or when — `Log::register()`
-- handled that separately, outside this table. runcodes-api's admin
-- broadcast feature (docs/roadmap/gap-audit-2026-10.md item 9) needs a
-- self-contained history view, so these three columns move that metadata
-- into the row itself instead of relying on a separate audit log lookup.

ALTER TABLE messages ADD COLUMN sender_email varchar(255);
ALTER TABLE messages ADD COLUMN sent_at timestamp without time zone NOT NULL DEFAULT now();
ALTER TABLE messages ADD COLUMN recipient_count integer NOT NULL DEFAULT 0;
