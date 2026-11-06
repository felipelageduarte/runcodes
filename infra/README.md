# Infraestrutura AWS do run.codes

Produção de validação: **um servidor** com o `docker-compose.prod.yml` do monorepo,
atrás do CloudFront (HTTPS no domínio `*.cloudfront.net`), tudo em Terraform num
state próprio. Nada aqui depende da VPC, do RDS ou de qualquer recurso do
emboabaDuarte ou de outro projeto: a conta `220395825071` só hospeda.

```
Navegador ──HTTPS──> CloudFront ──HTTP:80 + X-Origin-Verify──> EC2 t4g.small (Elastic IP)
                                                                 └ Caddy ─ api ─ Postgres
                                                                         ├ plagiarism-worker ─ Redis
                                                                         ├ rcc (compilador, containers irmãos)
                                                                         └ Seaweed (S3 local)
        EBS de dados (/data) ── snapshot diário (DLM, 7 dias)
        S3 de backup ── pg_dump + arquivos, diário 03:30 UTC (60 dias)
        SSM Session Manager ── acesso administrativo (sem SSH, sem porta aberta)
```

## Mapa

| Caminho | O que é |
|---|---|
| `terraform/` | VPC, EC2, EBS, EIP, CloudFront, S3, SSM, alarmes, orçamento, roles OIDC do GitHub |
| `scripts/deploy.sh` | Único caminho de deploy (CI e local): plan, plan-guard, apply, SSM, health |
| `scripts/remote-deploy.sh` | Roda na instância: `.env` do SSM, imagens, build web/docs, `compose up` |
| `scripts/host-setup.sh` | Prepara o host (Docker, swap, volume, agente CloudWatch, timer de backup) |
| `scripts/backup.sh` | Backup diário para o S3 e métrica `Runcodes/BackupSuccess` |
| `scripts/bootstrap-state.sh` | Cria bucket de state e lock (uma vez) |
| `scripts/lifecycle.sh` | `pause` / `resume` / `status` |
| `scripts/teardown.sh` | Desliga tudo guardando uma cópia dos dados |
| `docs/` | [Operação](docs/operacao.md), [CI/CD e proteções](docs/ci-cd.md), [Segregar, pausar e desligar](docs/segregacao.md), [ADR](docs/adr/001-ec2-unica-cloudfront.md) |

## Custo (estimativa mensal, us-east-1)

Ligado: ~US$ 26 a 30 (t4g.small 12, EBS 56 GB 4,5, IPv4 público 3,7, snapshots e
S3 ~2, alarmes e métricas ~2, health check ~1; CloudFront cabe no free tier).
Pausado (`lifecycle.sh pause`): ~US$ 10. Desligado (`teardown.sh`): zero. Alerta de
orçamento em 80% real e 100% previsto de US$ 40 (variável `monthly_budget_usd`).

## Limites conhecidos (validação, não produção definitiva)

- Host único: reboot ou troca de tipo derruba o serviço por minutos. Sem Multi-AZ.
- 2 GB de RAM: concorrência do compilador em 2 e swap de 2 GB. Suba `instance_type`
  para `t4g.medium` se o alarme `runcodes-memory-high` ou `cpu-credits-low` disparar.
- Só as linguagens de `compiler_langs` (padrão: c cpp python java) têm imagem.
- E-mail (cadastro, reset) só funciona depois de configurar SMTP: ver
  [Operação](docs/operacao.md#smtp).
- Sem WAF nem rate limit na borda. Antes de abrir para público amplo, avaliar.
- O restore do Postgres foi ensaiado em 2026-11-06 (5 s, banco vazio); o dos arquivos do Seaweed
  ainda não. Tempos com dados reais: registrar em
  [Segregar, pausar e desligar](docs/segregacao.md#restore-ensaiado).
