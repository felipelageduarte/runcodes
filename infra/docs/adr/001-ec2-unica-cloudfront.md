# ADR 001: servidor único (EC2) atrás do CloudFront, stack isolada

Data: 2026-11-06
Status: aceito

## Contexto

O run.codes precisa ir ao ar para outras pessoas validarem, com a possibilidade de ser desligado
ou movido para outra conta depois. O `rcc` (compilador) sobe containers irmãos e exige o socket do
Docker, o que exclui Fargate/Lambda. Já existe um deploy por Docker Compose (`deploy/compose`).
Domínio próprio ainda não existe.

## Decisão

- Uma EC2 `t4g.small` (menor viável; arm64 como no resto da conta) rodando o compose existente,
  com Postgres, Redis e Seaweed em containers, volume EBS de dados separado e snapshots diários.
- Borda no CloudFront com o domínio padrão `*.cloudfront.net` (HTTPS sem certificado). Origin em HTTP
  na porta 80, aberta só à prefix list do CloudFront e com cabeçalho secreto verificado pelo Caddy.
- Sem NAT, sem RDS, sem SSH: SSM para acesso. Custo ~US$ 26 a 30/mês.
- VPC, state, IAM e tags próprios; nada compartilhado com o RDS/VPC do emboabaDuarte (ADR 006 de lá
  não se aplica). Terraform 1.5.7 e provider `~> 6`.
- Segredos da aplicação gerados na instância e guardados no SSM, fora do state.
- CI/CD, ruleset e proteções replicados do emboabaDuarte; deploy por SSM em vez de Lambda.

## Consequências

- Host único sem redundância; manutenção derruba o serviço. Aceito para validação.
- RAM de 2 GB limita a concorrência; sobe-se o tipo se os alarmes dispararem.
- Ao ligar domínio próprio, trocar o certificado do CloudFront e religar checks do checkov.
- Para produção definitiva, reavaliar RDS, Multi-AZ e WAF (revisão `/revisao` antes).
