# Auditoria de correção e segurança — runcodes-compiler-sandbox e runcodes-compiler-images

Data: 2026-10-15. Branch auditado: `feat/p1-p2-sandbox-hardening` (ambos os repositórios, working tree limpa antes da auditoria).

Contexto de severidade: o código do aluno roda dentro de um container Docker descartável, um por commit. Dano restrito ao próprio container/commit do aluno = severidade baixa; fraude do resultado da própria correção = alta; escape de container, acesso à rede interna ou interferência em outros commits = crítica. Nenhum vetor de escape de container foi encontrado nos dois módulos auditados (as decisões de contenção do Docker — network, caps, cgroups — vivem no runcodes-compiler, fora do escopo; o ADR `docs/adr-sandbox-isolation.md` registra `network_mode=none`, `cap_drop=ALL` e `no-new-privileges` como já aplicados lá).

Estado de partida: este branch já implementa a maior parte dos itens P1/P2 de `runcodes-compiler-sandbox-oportunidades.md` (B1, B3, B4, B7, B8, B10, S5, S8, E1, E2, E3 parcial, E7 parcial, E8 parcial, E9 parcial, E10). A auditoria confirmou essas correções no código e procurou o que restou ou regrediu.

Verificação de build/testes: `cmake -B build && cmake --build build` em `debian:trixie-slim` compila sem nenhum warning (`-Wall -Wextra -D_FORTIFY_SOURCE=2 -fstack-protector-strong`, link estático); `ctest` passa 2/2 (unit + integração), antes e depois das correções desta auditoria. `tests/test_base_script.sh` do runcodes-compiler-images passa 5/5.

## Achados corrigidos nesta auditoria

### M1 — [BAIXO] Race de setpgid entre pai e filho — runcodes-compiler-sandbox/src/monitor.c:379 — CORRIGIDO
O filho chama `setpgid(0,0)` depois do fork, mas o pai assumia o grupo já existente ao chamar `kill(-child_pid, SIGKILL)` (timeout e cleanup final). Com um `-t` muito curto, o kill podia disparar antes de o filho ser escalonado: `ESRCH`, filho vivo, e o monitor bloqueado para sempre em `wait4()` (DoS do teste, consumindo o timeout do engine). Correção: `setpgid(pid, pid)` também no pai (padrão clássico dos dois lados); `EACCES` significa que o filho já executou o próprio setpgid.

### M2 — [BAIXO] Retorno de `prctl(PR_SET_NO_NEW_PRIVS)` ignorado — runcodes-compiler-sandbox/src/monitor.c:214 — CORRIGIDO
Em `drop_privileges()`, falha do prctl era silenciosa. Agora falha do prctl aborta como qualquer falha de drop (exit 254), em vez de rodar com mais privilégio do que o pedido.

### I1 — [MÉDIO] `cp -r --update=none` quebra em coreutils < 9.3 — runcodes-compiler-images/base/base-script.sh:160 — CORRIGIDO
`--update=none` existe só a partir do coreutils 9.3. Na imagem vhdl (base `ghdl:bookworm-gcc-12.3.0`, coreutils 9.1) o comando falha com "option '--update' doesn't allow an argument" (reproduzido em `debian:bookworm-slim`), os fontes nunca são copiados para os diretórios de teste e toda execução quebra silenciosamente (não há `set -e`). Trocado por `cp -rn`, semanticamente idêntico (pula arquivos existentes) e verificado em bookworm e trixie.

### I2 — [ALTO, funcional] `$1` dentro de string passada a eval — runcodes-compiler-images/verilog/verilog-script.sh:2 — CORRIGIDO
`pre_run_command="iverilog -o ${user_bin} ${src_file} ../\$1.in"` é avaliado por `eval "${pre_run_command} ${test_id}"` dentro de `run_tests`; nesse ponto `$1` expande para o primeiro parâmetro posicional de `run_tests` (o run command), produzindo `iverilog -o executable src.v .././executable.in <id>` (reproduzido em simulação). Toda submissão verilog sem Makefile falhava. Corrigido convertendo para função `verilog_pre_run()` que recebe o test_id como `$1` real. Recomenda-se smoke test com a imagem real (`make build-verilog`) antes de publicar.

### I3 — [MÉDIO, funcional] `mv` com redirect em vez de destino — runcodes-compiler-images/r/r-script.sh:5 — CORRIGIDO
`mv /tmp/src.r >"${src_file}"` truncaria o fonte do aluno para vazio (redirect) e o `mv` falharia por falta de operando. Corrigido para `mv /tmp/src.r "${src_file}"`. Hoje inerte (ver R1 abaixo), mas era uma bomba armada para quando a função fosse ativada. O typo `pre_run_commmand` (3 m's) também foi corrigido.

### I4 — [BAIXO] Imagem lua sem `make` — runcodes-compiler-images/lua/Dockerfile:5 — CORRIGIDO
O base-script oferece `make all`/`make -s run` para submissões com Makefile em todas as linguagens, mas a imagem lua era a única das derivadas que não instalava `make`. Adicionado ao apt-get install.

## Achados reportados (design/arquitetura ou correção arriscada — não alterados)

### R1 — [MÉDIO] make_src do R não está ligado e run_codes_functions.r tem erro de R — runcodes-compiler-images/r/r-script.sh, r/run_codes_functions.r:~22
`pre_run_command=make_src` é inócuo: `run_tests` sobrescreve `pre_run_command` com seu `$2`, e o r-script só passa 1 argumento. Portanto o prepend de `run_codes_functions.r` (que silencia `require`/`library`) nunca acontece — submissões R rodam sem os helpers há tempo indeterminado. Antes de ligar (`run_tests "$run_command" make_src`), é preciso corrigir `run_codes_functions.r`: o override de `library()` passa `lib.loc = lib.loc` duas vezes, o que é erro em R ("matched by multiple actual arguments") — ligar o prepend como está quebraria toda submissão que chama `library()`. Mudança de comportamento de correção: decisão de produto, não aplicada.

### R2 — [MÉDIO] `&&` em run_command não funciona sob o monitor — runcodes-compiler-images/vhdl/vhdl-script.sh:3
`run_command="ghdl -a ${src_file} && ghdl --elab-run ${src_file%.vhd}"`: o monitor faz `execvp` direto (split por espaço/tab, sem shell), então `&&` vira argumento literal do `ghdl -a`. Submissões vhdl sem Makefile estão quebradas. Correção exige wrapper (função pre_run que analisa, como no fix do verilog, deixando só o elab-run como run_command) e teste com a imagem real — não aplicada.

### R3 — [ALTO] Tudo roda como root dentro do container; `-u` do monitor não está ligado — runcodes-compiler-images/base/base-script.sh:107,172 (invocações do monitor), todas as imagens (sem `USER`)
O monitor já suporta `-u uid:gid` (S3 do documento de oportunidades, com teste de integração), mas nenhum script passa a flag e nenhuma imagem cria usuário sem privilégio. Consequências dentro do container: o Makefile do aluno (fase de compilação) pode sobrescrever `/usr/bin/monitor`/`/usr/bin/runcodes` e forjar `signal=`/`status=` de todos os testes do próprio commit (fraude de nota); pode `kill -STOP 1` (DoS barato do commit, consome timeout do engine); e o `chmod 600 ./*.in` de run_tests é no-op (admitido em comentário no próprio script). Não é escape de container, mas é integridade da correção: a recomendação é criar o usuário `runner` na imagem base e passar `-u` nas duas invocações do monitor (compilação inclusive), com `chown` do workspace. Mudança coordenada entre base image, scripts e permissões do volume — não aplicada.

### R4 — [MÉDIO] Injeção de shell via `test_id` forjado na fase de compilação — runcodes-compiler-images/base/base-script.sh:173,190
`test_id` deriva do nome dos diretórios `test_*` do workspace. A compilação (código do aluno) roda antes de `run_tests` e pode criar `test_$(payload)` ou `test_x; cmd`; depois `eval "${pre_run_command} ${test_id}"` executa o payload (relevante nas imagens que usam pre/post_run: verilog, portugol). Como o aluno já executa código arbitrário como root via Makefile, o ganho direto do atacante é pequeno — o risco real é o secundário: diretórios de teste forjados produzem `<id>.output`/`<id>.monitor_out` falsos copiados para `outputfiles/`, e a defesa passa a depender de o engine ignorar ids inesperados (verificar em grading.py). Correção sugerida: validar `[[ "$test_id" =~ ^[0-9]+$ ]]` e pular diretórios não conformes; e nunca interpolar `test_id` em eval (chamar função com argumento). Toca o núcleo compartilhado por 24 imagens — não aplicada nesta passada.

### R5 — [MÉDIO] Escape do process-group via `setsid()` — runcodes-compiler-sandbox/src/monitor.c:352
O cleanup `kill(-child_pid, SIGKILL)` cobre daemonização comum, mas um processo que chama `setsid()` sai do grupo e sobrevive entre testes (pode reescrever `.output`/`.monitor_out` de testes já concluídos antes de o engine ler — adulteração retroativa, S6 residual; o ADR já reconhece o limite). Mitigação real: `pids`/kill de cgroup por teste ou PID namespace (E4/E5 do roadmap) — arquitetural, não aplicada.

### R6 — [MÉDIO] Testes sem limite de memória/arquivo em três linguagens — runcodes-compiler-images/dotnet/dotnet-script.sh:9-10, java/java-script.sh:8, portugol/portugol-script.sh:14
`monitor_max_ms=0` (java, portugol, dotnet) e `monitor_max_fs=0` (dotnet): nenhum limite por processo; a contenção fica 100% no cgroup do container (engine). FIXMEs conhecidos; a solução correta é limite de memória de cgroup por linguagem (E4) em vez de RLIMIT_AS, que é inadequado para JVM/CLR — não aplicada.

### R7 — [MÉDIO] Casos de teste legíveis (e exfiltráveis) pelo programa do aluno — runcodes-compiler-images/base/base-script.sh:139-156
Todos os `.in` ficam no workspace e o programa roda como root (R3), então o teste 1 pode ler `../2.in`, `../N.in` e copiá-los para o próprio `.output` — se o aluno visualiza o output produzido, inputs de testes fechados vazam sem precisar de rede. O chmod 600/644 existente passa a valer no momento em que R3 for resolvido. Reportado (depende de R3 ou de isolamento por teste, E11).

### R8 — [BAIXO] `status=TLE` por CPU não liga `timeout=1` — runcodes-compiler-sandbox/src/monitor.c:277-289
SIGXCPU com `-T` classifica `status=TLE`, mas `timed_out` (campo `timeout=`) fica 0 — ele reflete só o timeout de wall clock. Consumidor que olhe apenas `timeout=` perde TLE de CPU. Ou documentar explicitamente em `docs/output-format.md`, ou setar `timed_out=1` também nesse ramo (mudança de contrato observável — decisão deixada para o dono do formato).

### R9 — [BAIXO] `O_NOFOLLOW` protege só o último componente do caminho — runcodes-compiler-sandbox/src/monitor.c:172
Symlink em diretório intermediário ainda é seguido (`O_NOFOLLOW` não é `RESOLVE_NO_SYMLINKS`). Os caminhos vêm dos scripts (relativos, `../<id>.output`), e com R3 resolvido o aluno não cria symlinks com dono root; risco residual baixo. `openat2(RESOLVE_NO_SYMLINKS)` seria o upgrade.

### R10 — [BAIXO] `execvp` com PATH e ambiente herdados — runcodes-compiler-sandbox/src/monitor.c:267
S11 residual: resolução via PATH e ambiente não sanitizado. Com root no container (R3), o Makefile do aluno pode trocar binários no filesystem de qualquer forma; depois do drop de privilégio isso vira relevante — trocar para `execve` com ambiente mínimo junto com R3.

### R11 — [BAIXO] Sem suporte a quoting no `-c` — runcodes-compiler-sandbox/src/monitor.c:91 (parse_args)
Split por espaço/tab, sem aspas: `src_file` com espaço quebra a execução (confusamente, não perigosamente — não há shell). Limitação documentada (B9); redesign sugerido: `monitor [opts] -- prog args...`.

### R12 — [BAIXO] `src_file` não validado nos scripts — runcodes-compiler-images/*/\*-script.sh
Nome do arquivo submetido é interpolado nos comandos (sem shell injection: parser key=value do config + exec sem shell no monitor), mas permite path traversal intra-container (ex.: `cp "./src/${src_file}"` no java-script) e flags extras para o compilador. Dentro do container, baixo; uma validação `[[ "$src_file" =~ ^[A-Za-z0-9._-]+$ ]]` no base-script fecharia a classe.

### R13 — [BAIXO] Tags de imagem flutuantes e dependências antigas no portugol
`rust:slim`, `hdlc/iverilog:latest`, `golang:trixie` e o próprio `runcodes-compiler-sandbox:latest`/`runcodes-compiler-images-base:latest` são tags móveis (reprodutibilidade/supply chain; renovate/dependabot existem nos dois repos — considerar pin por digest). As demais bases estão atuais (debian trixie, python 3.14, temurin 25, dotnet 10 noble, julia 1.12, fedora 44, octave 11.3). Exceções: vhdl em bookworm (suportado, mas uma major atrás) e os jars do portugol de ~2018 (jackson-databind 2.9.5 tem CVEs de desserialização conhecidos; vetor improvável no uso local sem rede do container — baixo).

### R14 — [BAIXO] `src/Makefile` diverge do build CMake — runcodes-compiler-sandbox/src/Makefile:1
Build manual usa `-Wall -O2 -static` sem os flags de hardening do CMakeLists (`-Wextra -D_FORTIFY_SOURCE=2 -fstack-protector-strong`). O Dockerfile usa CMake; o Makefile manual é um segundo build que pode driftar — considerar removê-lo ou reduzi-lo a um wrapper de cmake.

### R15 — [INFO] `make all`/`make -s run` com Makefile do aluno: aceitável dado o isolamento, com as ressalvas acima
O Makefile é execução arbitrária por construção — isso é inerente ao requisito (corrigir código arbitrário) e é aceitável ENQUANTO: (a) o engine mantiver `network_mode=none`, `cap_drop=ALL`, `no-new-privileges` e limites de cgroup (pids/mem/cpu) no `containers.run`, e (b) R3/R4/R5 forem tratados para que "arbitrário" não inclua forjar o resultado da própria correção. Nenhum vetor de escape do container existe nestes dois módulos em si (não há mounts perigosos nem privileged aqui; isso é decidido no engine).

## Resumo

| # | Severidade | Local | Status |
|---|---|---|---|
| M1 | Baixa | monitor.c:379 (race setpgid) | Corrigido |
| M2 | Baixa | monitor.c:214 (prctl sem check) | Corrigido |
| I1 | Média | base-script.sh:160 (cp --update=none) | Corrigido |
| I2 | Alta (funcional) | verilog-script.sh:2 ($1 no eval) | Corrigido |
| I3 | Média (funcional) | r-script.sh:5 (mv com redirect) | Corrigido |
| I4 | Baixa | lua/Dockerfile:5 (sem make) | Corrigido |
| R1 | Média | r-script.sh / run_codes_functions.r | Reportado |
| R2 | Média | vhdl-script.sh:3 (&& sob execvp) | Reportado |
| R3 | Alta | base-script + imagens (root, -u não ligado) | Reportado |
| R4 | Média | base-script.sh:173 (eval test_id forjável) | Reportado |
| R5 | Média | monitor.c:352 (setsid escapa do pgroup) | Reportado |
| R6 | Média | dotnet/java/portugol (limites 0) | Reportado |
| R7 | Média | base-script (leitura/exfiltração de .in) | Reportado |
| R8 | Baixa | monitor.c:277 (TLE de CPU sem timeout=1) | Reportado |
| R9 | Baixa | monitor.c:172 (O_NOFOLLOW parcial) | Reportado |
| R10 | Baixa | monitor.c:267 (execvp/PATH) | Reportado |
| R11 | Baixa | monitor.c:91 (sem quoting) | Reportado |
| R12 | Baixa | scripts (src_file sem validação) | Reportado |
| R13 | Baixa | Dockerfiles (tags flutuantes; jars portugol) | Reportado |
| R14 | Baixa | src/Makefile (drift de flags) | Reportado |
| R15 | Info | Makefile do aluno: aceitável com ressalvas | Reportado |

Pós-correção: rebuild CMake sem warnings e `ctest` 2/2 em debian:trixie-slim; `tests/test_base_script.sh` 5/5; `cp -rn` validado em bookworm e trixie; mecânica do fix verilog validada em simulação bash (requer smoke test com a imagem real). Nenhuma alteração foi commitada.
