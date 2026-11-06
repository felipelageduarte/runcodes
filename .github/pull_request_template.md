## O que muda

<!-- Uma frase: o que o usuário/sistema ganha. Causa raiz se for fix. -->

## Como foi validado

<!-- Testes rodados, terraform plan lido, deploy em produção verificado, tela testada em 390px. -->

## Checklist "pronto"

- [ ] Testes cobrem o caminho feliz e as bordas relevantes (`test` verde)
- [ ] Doc atualizada no mesmo PR (`infra/docs/`, `CLAUDE.md`, ADR se decisão)
- [ ] Componente assíncrono novo sai com monitoramento (alarme, retry com limite, falha propagada)
- [ ] `.tf` novo passou `terraform fmt`; plano lido (nada destruído sem intenção)
- [ ] Depois do merge: `gh run watch` até o health check e verificação em produção
