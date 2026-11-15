-- A3 / F3 (docs/specs/admin-e-separacao-front.md): gestão de usuários.
-- disabled_at: conta desativada não loga e perde a sessão (token_version + 1 ao desativar).
-- invited_at: conta criada por convite do admin; a senha nasce no aceite do convite
-- (o token de 72 h reaproveita confirmation_token_hash / confirmation_token_expires_at).
-- Aditiva: o código anterior ignora as colunas.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at timestamp;
