---
title: Tipos de arquivo e linguagens
sidebar_position: 2
---

# Tipos de arquivo e linguagens

O catálogo `allowed_files` é a lista global de **extensões/tipos de arquivo** que exercícios podem aceitar (`.c`, `.py`, `.java`, `.zip`, `.pdf`...). É mantido por admin (painel → Tipos de arquivo) e consumido em três pontos:

1. **Autoria de exercício** — o professor escolhe, do catálogo, quais extensões o exercício aceita (`allowed_files_exercises`).
2. **Validação de submissão** — a API rejeita upload com extensão fora da allow-list do exercício (`422 file_type_not_allowed`). Exercícios "ghost" resolvem a allow-list pelo exercício original (`real_id`).
3. **Editor** — o realce de sintaxe do Monaco é derivado da extensão.

## Extensão ↔ linguagem de compilação

A extensão determina a **linguagem**, e a linguagem determina a **imagem Docker** usada na correção (mapeamento em `runcodes-compiler/src/rcc/languages.py`). Por isso, cadastrar um tipo de arquivo novo no catálogo **não basta** pra suportar uma linguagem nova — o checklist completo (imagem + `languages.py` + catálogo) está em [Pipeline: adicionando uma linguagem](../operacao/pipeline.md#adicionando-uma-linguagem).

Tipos **não-compiláveis** (ex.: `.pdf` pra entrega de relatório) são legítimos no catálogo: exercícios `type = 1` aceitam o arquivo e ficam aguardando correção manual, sem passar pelo engine.

## Casos especiais

- **`.zip`** — habilita projetos multi-arquivo: o conteúdo precisa ter um `Makefile` (`make all` / `make run`), que as imagens de linguagem detectam e usam no lugar do comando padrão.
- **Extensões sempre bloqueadas em anexos** — `exe`, `php`, `htm`, `html` são rejeitadas no upload de arquivos de exercício (nunca servidas de volta); downloads saem sempre como `application/octet-stream`.

## Limites de tamanho de submissão

Fixos na API (herdados do legado): **1 MB** pra exercícios compiláveis, **5 MB** pra não-compiláveis.
