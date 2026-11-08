-- Trilha de auditoria de verdade (spec docs/specs/admin-e-separacao-front.md, F1).
-- A tabela legada `logs` guarda só "METHOD url -> status" numa coluna de texto,
-- com `ip varchar(15)` que trunca IPv6. Esta tabela recebe toda requisição que
-- passa pelo middleware auditLog (ator, tipo, view-as, método, rota normalizada,
-- status, duração, ip inteiro, user-agent, request id e corpo redigido).
-- `logs` continua existindo, somente leitura (aba "Legado"), até vencer a retenção.
-- Aditiva: nada em `logs` muda.

CREATE TABLE IF NOT EXISTS audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_email   varchar(255),
  actor_type    integer,
  view_as_type  integer,
  method        varchar(10) NOT NULL,
  path          text NOT NULL,
  route         text NOT NULL,
  status        integer NOT NULL,
  duration_ms   integer,
  ip            text,
  user_agent    text,
  request_id    text,
  request_body  jsonb,
  target_type   text,
  target_id     text
);

CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_email ON audit_log (actor_email, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_route ON audit_log (route, at DESC);
