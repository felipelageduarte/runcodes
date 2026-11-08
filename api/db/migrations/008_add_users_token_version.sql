-- F2 (docs/specs/admin-e-separacao-front.md): sessão revogável.
-- Cada JWT carrega a claim `tv`; trocar senha, tipo ou confirmação do usuário
-- incrementa token_version e invalida todo token emitido antes.
-- Aditiva: o código anterior ignora a coluna (default 0).
-- Numerada 008 porque a F1 (audit_log) usa a 007 em paralelo; o migrate.sh
-- aplica por nome, então lacuna de numeração não importa.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
