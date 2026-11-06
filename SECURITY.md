# Política de segurança

Plataforma de correção automática de exercícios de programação, em validação com usuários reais.
Executa código enviado por alunos em sandbox: levamos a sério qualquer relato, inclusive suspeita
sem prova. Escape de sandbox, execução de código fora do container e acesso a dados de outros
usuários têm a maior prioridade.

## Versões suportadas

Só a `main` existe: todo merge vai a produção. Relato é sempre contra o que está no ar.

## Como reportar

**Não descreva a falha em issue ou PR públicos** (o repositório é público). Use:

- **Relato privado do GitHub**: aba *Security* > *Report a vulnerability* neste repositório.
- Ou e-mail para **felipelageduarte@gmail.com**, assunto `[runcodes] segurança`.

Português ou inglês. Nunca cole credencial, token ou dado de aluno no relato: cite onde está.

## O que incluir

Tipo da falha, arquivos e rotas afetados, passo a passo para reproduzir, impacto (o que um atacante
consegue), e como quer ser creditado.

## O que esperar (metas, não promessas)

Confirmação em até 72 horas, triagem em até 7 dias, atualização a cada 14 dias até fechar. Severidade
alta ou crítica tem prioridade sobre qualquer outro trabalho e sai pelo fluxo normal (PR, CI, deploy).
Relato recusado recebe a justificativa. Divulgação coordenada: corrigimos e publicamos, depois
creditamos.
