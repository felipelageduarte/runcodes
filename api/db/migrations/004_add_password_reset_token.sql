-- Separate columns from confirmation_token_* (migration 002): a password
-- reset request shouldn't be able to clobber (or be clobbered by) a
-- pending email confirmation, so they can't share storage.

ALTER TABLE users ADD COLUMN reset_token_hash character varying(64);
ALTER TABLE users ADD COLUMN reset_token_expires_at timestamp without time zone;
