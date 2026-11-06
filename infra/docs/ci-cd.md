# CI/CD e proteções do GitHub

Mesmo desenho do emboabaDuarte (`.claude/rules/infra.md` de lá), adaptado ao monorepo.

## Fluxo

PR para `main` -> `ci.yml` (`test`, `terraform-plan`, `security`) -> merge -> `deploy.yml`.

| Job | O que garante |
|---|---|
| `test` | api (build + vitest), web (oxlint + vitest + build), docs (tsc + build), compiler (ruff + unittest), plan-guard |
| `terraform-plan` | `fmt -check`, `validate`, `plan` somente leitura (role `runcodes-github-plan`) |
| `security` | gitleaks (commits do PR), `npm audit` (api em `high`; web em `critical` até migrar o zod, ver `CLAUDE.md`), semgrep 1.183.0, checkov 3.4.3 |

Deploy: concorrência serializada (`deploy-production`), role `runcodes-github-deploy` (só `main`),
plan-guard recusa destruir instância, volume de dados, VPC, CloudFront, buckets ou IAM; para liberar,
rode o workflow à mão com `allow_destructive` depois de ler o plano.

## Proteções do repositório

- **Ruleset `main`** (`.github/rulesets/main.json`): PR obrigatório, `test` + `terraform-plan` +
  `security` verdes e atualizados com a `main`, conversas resolvidas, sem force push nem delete,
  **commits assinados**. Push direto bloqueado para todos; admin só mergeia PR sem esperar checks.
- **Actions**: fixadas por SHA (`sha_pinning_required`), allowlist (GitHub, verified creators,
  `aws-actions/*`, `hashicorp/*`, gitleaks, checkov), `GITHUB_TOKEN` somente leitura por padrão e
  sem aprovar PR.
- **OIDC** sem access keys; trust no claim `sub` imutável (`owner@id/repo@id`). Fork não recebe token.
- **Dependabot** semanal (npm x3, pip, terraform, actions), cooldown de 7 dias, **sem auto-merge**:
  merge na `main` é deploy em produção.
- Repositório **público**: nenhum segredo no código ou no histórico; gitleaks barra. Credencial que
  aparecer em commit é tratada como vazada e rotacionada.

## Aplicar as configurações (uma vez)

```bash
gh api -X PUT repos/felipelageduarte/runcodes/actions/permissions \
  -F enabled=true -f allowed_actions=selected -F sha_pinning_required=true
gh api -X PUT repos/felipelageduarte/runcodes/actions/permissions/selected-actions \
  -F github_owned_allowed=true -F verified_allowed=true \
  -f 'patterns_allowed[]=aws-actions/*' -f 'patterns_allowed[]=hashicorp/*' \
  -f 'patterns_allowed[]=gitleaks/gitleaks-action@*' -f 'patterns_allowed[]=bridgecrewio/checkov-action@*'
gh api -X PUT repos/felipelageduarte/runcodes/actions/permissions/workflow \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api -X PATCH repos/felipelageduarte/runcodes -F delete_branch_on_merge=true
gh api -X POST repos/felipelageduarte/runcodes/rulesets --input .github/rulesets/main.json
```

Commits assinados: chave SSH como *signing key* no GitHub e `git config --global gpg.format ssh`,
`user.signingkey`, `commit.gpgsign true`.

## Bootstrap (ordem, uma vez)

1. `infra/scripts/bootstrap-state.sh` (bucket de state + lock).
2. `terraform init` e `apply -target` só das roles OIDC (o CI precisa delas para existir).
3. PR com a infra: o `terraform-plan` já roda com a role.
4. Ler o plano, merge: o deploy cria o resto e sobe a aplicação.
