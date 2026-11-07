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
