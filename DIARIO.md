# Diário de desenvolvimento

Registro do que fiz, o que quebrou e como investiguei. Escrito durante o processo, não no fim.

## 2026-11-06 (sex) — Setup do repositório

**O que fiz**
- Criei o repositório e a estrutura de pastas (api, worker, ui, observability, k8s, loadtest, .github/workflows).
- Adicionei `.gitattributes` com `eol=lf` antes do primeiro commit.

**Por quê**
- Já tive problema com CRLF no Windows: scripts `.sh` com CRLF quebram dentro de containers Linux.
  Normalizar desde o primeiro commit evita ter que fazer `git add --renormalize` depois.

**O que quebrou**
- Rodei `git init main` em vez de `git init -b main`, o que criou uma subpasta `main/`.
  Percebi porque o `git config` seguinte deu "not in a git directory". Apaguei a subpasta e reiniciei com `-b`.

**Uso de IA**
- Usei o Claude para montar `.gitattributes`, `.gitignore` e a estrutura inicial (boilerplate).

**Próximo passo**
- docker-compose.yml com a infraestrutura (MySQL, RabbitMQ, Redis, MongoDB, Prometheus).


## 2026-11-06 (sex) — Infraestrutura com docker compose

- Subi MySQL, RabbitMQ, Redis, MongoDB e Prometheus com healthchecks. Todos healthy na primeira tentativa.
- Healthcheck do MySQL usa `-h 127.0.0.1` para forçar TCP: na primeira subida o MySQL roda um servidor temporário só com socket, e um ping sem `-h` passaria cedo demais.
- MySQL exposto em 3307 no host para não conflitar com um MySQL local na 3306.
- Uso o WSL para subir os containers e o Git Bash para o Git.


## 2026-11-06 (sex) — Modelagem: concorrência ao aceitar corrida

- Problema: dois motoristas aceitando a mesma corrida ao mesmo tempo. SELECT + UPDATE deixa uma janela entre a leitura e a escrita.
- Primeira ideia: comparar timestamps. Descartei: comparar ainda exige ler antes de gravar, então a janela continua.
- Segunda ideia: CASE WHEN no SET. Descartei: o WHERE id = ? sempre encontra a linha, então não dá para saber quem perdeu.
- Solução: UPDATE condicional, com a condição de status no WHERE. Uma operação atômica no banco. Linhas afetadas = 1 → ganhou; 0 → 409 (ou 404, se a corrida não existir).

# Diário de desenvolvimento

Registro cronológico e informal do que tentei, do que quebrou, de como investiguei e do que aprendi.

---

## 2026-11-06 (sex)

### Setup do repositório
- Criei a estrutura de pastas (api, worker, ui, observability, k8s, loadtest, .github/workflows).
- Adicionei `.gitattributes` com `eol=lf` antes do primeiro commit. Já tive problema com CRLF no Windows: script `.sh` com CRLF quebra dentro de container Linux.
- Conferi com `git ls-files --eol`: tudo `i/lf`, inclusive com a regra do `.gitattributes` aparecendo na coluna `attr`.
- **Quebrou:** rodei `git init main` em vez de `git init -b main`, o que criou uma subpasta `main/` com o repositório dentro. Percebi porque o `git config` seguinte deu "not in a git directory". Apaguei a subpasta e reiniciei com `-b`.
- O prompt do Git Bash mostrava `UCRT64` e achei que fosse outro terminal. Era só a variável `MSYSTEM` do Windows; o `git --version` confirmou que é o Git for Windows.

### Ambiente
- Considerei mover tudo para o WSL e depois usar o PowerShell. Fiquei com o Git pelo Git Bash e o Docker pelo WSL (em `/mnt/c/...`), que foi o que funcionou melhor para mim.
- No PowerShell, o `cat << 'EOF'` não existe, e o PowerShell do Windows pode gravar arquivos com CRLF e BOM (um BOM no `.env` corromperia o nome da primeira variável). Por isso os arquivos foram criados pelo Bash.

### Infraestrutura com docker compose
- Subi MySQL, RabbitMQ, Redis, MongoDB e Prometheus com healthchecks. Todos healthy na primeira tentativa.
- Healthcheck do MySQL usa `-h 127.0.0.1` para forçar TCP: na primeira subida o MySQL roda um servidor temporário só com socket, e um ping sem `-h` passaria cedo demais.
- `depends_on` sozinho só espera o container iniciar, não ficar pronto. Por isso o `condition: service_healthy`.
- MySQL exposto na 3307 do host para não conflitar com um MySQL local na 3306.
- Ao colar os arquivos no terminal, a exibição deu a impressão de que faltava um `EOF`. Conferi com `cat` e `ls`, e os arquivos estavam corretos.

### Modelagem: concorrência ao aceitar corrida
- Problema: dois motoristas aceitando a mesma corrida ao mesmo tempo. `SELECT` + `UPDATE` deixa uma janela entre a leitura e a escrita.
- Primeira ideia: comparar timestamps. Descartei: comparar ainda exige ler antes de gravar, então a janela continua.
- Segunda ideia: `CASE WHEN` no `SET`. Descartei: o `WHERE id = ?` sempre encontra a linha, então os dois motoristas receberiam `affectedRows = 1`.
- Solução: `UPDATE` condicional, com a condição de status no `WHERE`. Uma operação atômica: 1 linha afetada → ganhou; 0 → 409 (ou 404 se a corrida não existir).
---

## 2026-11-07 (sáb)


### Máquina de estados
- Primeiro listei ações (aceita/inicia/finaliza) em vez de estados. Depois propus `disponivel → processando → em_andamento → finalizada`.
- `processando` era ambíguo num sistema com fila (parece que o worker ainda está trabalhando). Fiquei com `solicitada → aceita → em_andamento → finalizada`.
- Hesitei entre `disponivel` e `solicitada`. Escolhi `solicitada`: o passageiro solicita, e o nome descreve o fato, não a visão do motorista.
- Valores sem acento e sem espaço no banco; a UI formata na exibição.
- Permissões: criar = passageiro; aceitar = qualquer motorista (o primeiro ganha); iniciar e finalizar = só o motorista que aceitou. Basta uma coluna `motorista_id`.

### Esqueleto da API
- Recusei o @nestjs/observe oferecido pelo Nest CLI: é SaaS externo, o avaliador precisa reproduzir tudo localmente, e quero implementar logs e métricas eu mesmo.
- Escolhi CJS + Jest em vez de ESM + Vitest: o suporte a ESM no Nest é recente, as bibliotecas que vou usar têm mais exemplos em CommonJS, e o Jest é próximo do Jasmine que já usei.
- Aviso EBADENGINE no scaffold. Investiguei com `node -v`: estava no Node 20, que já está em EOL. Troquei para o Node 22 LTS com o nvm-windows e reinstalei o node_modules, e o aviso sumiu.
- `npm install` reportou 25 vulnerabilidades. Não rodei `npm audit fix --force`, porque ele pode subir versões major e quebrar o projeto. Com `npm audit --omit=dev`: 0 vulnerabilidades em produção; todas estão em ferramentas de desenvolvimento, que não vão para a imagem.
- `docker build` falhou com "open Dockerfile: no such file or directory", mesmo com o arquivo na pasta. Investiguei com `ls -la api | grep -i docker`: o arquivo se chamava `DockerFile`. O Windows não diferencia maiúsculas e minúsculas, mas o Docker roda no Linux, que diferencia.

### Schema e teste da concorrência
- Escrevi o `db/init/001_schema.sql` seguindo a decisão de não usar ORM (decisão 7 do `DECISIONS.md`).
- Testei o UPDATE condicional direto no MySQL: o primeiro motorista teve `Rows matched: 1, Changed: 1`; o segundo, `Rows matched: 0`. O WHERE barrou a linha, e o SET nem rodou