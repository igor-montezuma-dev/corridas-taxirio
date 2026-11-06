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
