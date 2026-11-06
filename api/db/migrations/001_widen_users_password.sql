-- Widen users.password from varchar(40) (legacy sha1 hex) to varchar(255)
-- so bcrypt hashes (60 chars) fit. Safe/backwards-compatible: existing
-- sha1 values are unaffected, PHP app keeps working unchanged.
-- Required before the Node auth module can rehash passwords to bcrypt
-- on successful legacy login.

ALTER TABLE users ALTER COLUMN password TYPE character varying(255);
