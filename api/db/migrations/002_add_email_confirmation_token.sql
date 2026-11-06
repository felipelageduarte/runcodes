-- Adds a real, expiring, random email-confirmation token instead of the
-- legacy approach (a deterministic sha1(salt + email) with no expiry,
-- recomputable forever by anyone who knows the salt). Only the sha256
-- hash of the token is stored, matching how passwords are handled.

ALTER TABLE users ADD COLUMN confirmation_token_hash character varying(64);
ALTER TABLE users ADD COLUMN confirmation_token_expires_at timestamp without time zone;
