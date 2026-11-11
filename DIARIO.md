# Diário de desenvolvimento

Registro do que fiz, o que quebrou e como investiguei. Escrito durante o processo, não no fim.

---

## 2026-11-06 (sex) — Setup do repositório e ambiente

**O que fiz**

- Criei a estrutura de pastas (api, worker, ui, observability, k8s, loadtest, .github/workflows).
- Adicionei `.gitattributes` com `eol=lf` antes do primeiro commit.
- Conferi com `git ls-files --eol`: tudo `i/lf`, inclusive com a regra do `.gitattributes` aparecendo na coluna `attr`.
- Considerei mover tudo para o WSL e depois usar o PowerShell. Fiquei com o Git pelo Git Bash e o Docker pelo WSL (em `/mnt/c/...`), que foi o que funcionou melhor para mim.

**Por quê**

- Já tive problema com CRLF no Windows: script `.sh` com CRLF quebra dentro de container Linux. Normalizar desde o primeiro commit evita ter que fazer `git add --renormalize` depois.
- No PowerShell, o `cat << 'EOF'` não existe, e o PowerShell do Windows pode gravar arquivos com CRLF e BOM (um BOM no `.env` corromperia o nome da primeira variável). Por isso os arquivos foram criados pelo Bash.

**O que quebrou**

- Rodei `git init main` em vez de `git init -b main`, o que criou uma subpasta `main/` com o repositório dentro. Percebi porque o `git config` seguinte deu "not in a git directory". Apaguei a subpasta e reiniciei com `-b`.
- O prompt do Git Bash mostrava `UCRT64` e achei que fosse outro terminal. Era só a variável `MSYSTEM` do Windows; o `git --version` confirmou que é o Git for Windows.

**Uso de IA**

- Usei o Claude para montar `.gitattributes`, `.gitignore` e a estrutura inicial (boilerplate).

**Próximo passo**

- docker-compose.yml com a infraestrutura (MySQL, RabbitMQ, Redis, MongoDB, Prometheus).

---

## 2026-11-06 (sex) — Infraestrutura com docker compose

**O que fiz**

- Subi MySQL, RabbitMQ, Redis, MongoDB e Prometheus com healthchecks. Todos healthy na primeira tentativa.
- MySQL exposto na 3307 do host para não conflitar com um MySQL local na 3306.

**Por quê**

- Healthcheck do MySQL usa `-h 127.0.0.1` para forçar TCP: na primeira subida o MySQL roda um servidor temporário só com socket, e um ping sem `-h` passaria cedo demais.
- `depends_on` sozinho só espera o container iniciar, não ficar pronto. Por isso o `condition: service_healthy`.

**O que quebrou**

- Ao colar os arquivos no terminal, a exibição deu a impressão de que faltava um `EOF`. Conferi com `cat` e `ls`, e os arquivos estavam corretos.

**Uso de IA**

- Usei o Claude para escrever o `docker-compose.yml`; revisei e tirei dúvidas sobre os healthchecks e o `depends_on`.

**Próximo passo**

- Modelagem: concorrência ao aceitar corrida

---

## 2026-11-06 (sex) — Modelagem: concorrência ao aceitar corrida

**O que fiz**

- Solução: `UPDATE` condicional, com a condição de status no `WHERE`. Uma operação atômica: 1 linha afetada → ganhou; 0 → 409 (ou 404 se a corrida não existir).

**Por quê**

- Problema: dois motoristas aceitando a mesma corrida ao mesmo tempo. `SELECT` + `UPDATE` deixa uma janela entre a leitura e a escrita.

**O que quebrou**

- Primeira ideia: comparar timestamps. Descartei: comparar ainda exige ler antes de gravar, então a janela continua.
- Segunda ideia: `CASE WHEN` no `SET`. Descartei: o `WHERE id = ?` sempre encontra a linha, então os dois motoristas receberiam `affectedRows = 1`.

**Uso de IA**

- —

**Próximo passo**

- Máquina de estados

---

## 2026-11-07 (sáb) — Máquina de estados

**O que fiz**

- Fiquei com `solicitada → aceita → em_andamento → finalizada`.
- Valores sem acento e sem espaço no banco; a UI formata na exibição.
- Permissões: criar = passageiro; aceitar = qualquer motorista (o primeiro ganha); iniciar e finalizar = só o motorista que aceitou. Basta uma coluna `motorista_id`.

**Por quê**

- `processando` era ambíguo num sistema com fila (parece que o worker ainda está trabalhando).
- Hesitei entre `disponivel` e `solicitada`. Escolhi `solicitada`: o passageiro solicita, e o nome descreve o fato, não a visão do motorista.

**O que quebrou**

- Primeiro listei ações (aceita/inicia/finaliza) em vez de estados. Depois propus `disponivel → processando → em_andamento → finalizada`.

**Uso de IA**

- —

**Próximo passo**

- Esqueleto da API

---

## 2026-11-07 (sáb) — Esqueleto da API

**O que fiz**

- Recusei o @nestjs/observe oferecido pelo Nest CLI.
- Escolhi CJS + Jest em vez de ESM + Vitest.

**Por quê**

- @nestjs/observe: é SaaS externo, o avaliador precisa reproduzir tudo localmente, e quero implementar logs e métricas eu mesmo.
- CJS + Jest: o suporte a ESM no Nest é recente, as bibliotecas que vou usar têm mais exemplos em CommonJS, e o Jest é próximo do Jasmine que já usei.

**O que quebrou**

- Aviso EBADENGINE no scaffold. Investiguei com `node -v`: estava no Node 20, que já está em EOL. Troquei para o Node 22 LTS com o nvm-windows e reinstalei o node_modules, e o aviso sumiu.
- `npm install` reportou 25 vulnerabilidades. Não rodei `npm audit fix --force`, porque ele pode subir versões major e quebrar o projeto. Com `npm audit --omit=dev`: 0 vulnerabilidades em produção; todas estão em ferramentas de desenvolvimento, que não vão para a imagem.
- `docker build` falhou com "open Dockerfile: no such file or directory", mesmo com o arquivo na pasta. Investiguei com `ls -la api | grep -i docker`: o arquivo se chamava `DockerFile`. O Windows não diferencia maiúsculas e minúsculas, mas o Docker roda no Linux, que diferencia.

**Uso de IA**

- O Claude escreveu o Dockerfile multi-stage; pedi a explicação de cada estágio antes de commitar.

**Próximo passo**

- Schema e teste da concorrência

---

## 2026-11-07 (sáb) — Schema e teste da concorrência

**O que fiz**

- Escrevi o `db/init/001_schema.sql` seguindo a decisão de não usar ORM (decisão 7 do `DECISIONS.md`).
- Testei o `UPDATE` condicional direto no MySQL: o primeiro motorista teve `Rows matched: 1, Changed: 1`; o segundo, `Rows matched: 0`. O `WHERE` barrou a linha, e o `SET` nem rodou.

**Por quê**

- —

**O que quebrou**

- —

**Uso de IA**

- —

**Próximo passo**

- Conexão com o banco e /health

---

## 2026-11-07 (sáb) — Conexão com o banco e /health

**O que fiz**

- Testei o /health derrubando o MySQL: 503 em cerca de 2 segundos, e 200 de novo quando ele voltou, sem reiniciar a API, porque o pool reconecta sozinho.
- Notei o cabeçalho `X-Powered-By: Express` nas respostas e desliguei com `app.disable('x-powered-by')`.

**Por quê**

- `X-Powered-By`: é higiene, não proteção.

**O que quebrou**

- Erro TS1272 ao injetar o pool: `Pool` é uma interface do mysql2 e não existe em runtime, mas o `emitDecoratorMetadata` tenta gravar o tipo dos parâmetros do construtor. Resolvi com `import type { Pool }`. A injeção funciona porque o token `DB_POOL` no `@Inject` é quem diz o que injetar.

**Uso de IA**

- —

**Próximo passo**

- Decisão do JWT

---

## 2026-11-07 (sáb) — Decisão do JWT

**O que fiz**

- Escolhi RS256 com chave pública.

**Por quê**

- Verifiquei o trade-off de reiniciar a API para trocar a chave e percebi que o custo real não é o reinício (com rolling update não há queda), e sim os tokens já emitidos, que deixam de valer.

**O que quebrou**

- —

**Uso de IA**

- —

**Próximo passo**

- Autenticação JWT

---

## 2026-11-08 (dom) — Autenticação JWT

**O que fiz**

- Gerei um par RSA de teste em `keys/test-fixtures/` e um script (`scripts/generate-token.mjs`) que assina tokens só com o `crypto` do Node. A API recebe só a chave pública, montada como arquivo pelo compose.
- Testei os três cenários do PDF em `/auth/me`: sem token → 401 "Token ausente"; token inválido → 401 "Token inválido"; token válido → 200 com `sub` e `perfil`.
- Testei um token com o perfil trocado no payload e a assinatura original: 401. A assinatura cobre o payload, e só quem tem a chave privada consegue assinar de novo.
- No RolesGuard, escolhi fail-closed: rota sem @Roles é negada com 403.

**Por quê**

- RolesGuard: considerei deixar passar, como no exemplo da documentação, mas preferi que a permissão seja sempre explícita. O custo é pequeno: só as três rotas de corridas usam o guard. Se o controller crescer, dá para definir um @Roles padrão na classe com getAllAndOverride.

**O que quebrou**

- Precisei corrigir minha explicação mais de uma vez: a chave que assina não fica na API.

**Uso de IA**

- O Claude escreveu o `scripts/generate-token.mjs`. Os guards eu escrevi, e ele revisou.

**Próximo passo**

- POST /corridas

---

## 2026-11-08 (dom) — POST /corridas

**O que fiz**

- Testei seis cenários: criação (201), repetição com a mesma chave (200, mesmo id e mesmo ETag), motorista criando (403), sem Idempotency-Key (400), `status` no corpo (400 pelo `.strict()`) e origem só com espaços (400 pelo `.trim()`). [VÍDEO - idempotência]
- No banco: 1 corrida e 1 chave para os dois POSTs com a mesma chave. A corrida da repetição foi inserida e desfeita pelo rollback.

**Por quê**

- —

**O que quebrou**

- O 403 vinha com "Forbidden resource", a mensagem padrão do Nest quando o guard devolve `false`. Troquei por um `throw` com mensagem própria.

**Uso de IA**

- —

**Próximo passo**

- GET /corridas/:id

---

## 2026-11-08 (dom) — GET /corridas/:id

**O que fiz**

- Extraí a regra de permissão para o método `canRead`, que só devolve `true`/`false`, e usei cláusulas de guarda para sair cedo com 404 e 403.
- Testei: dono → 200, outro passageiro → 403, motorista numa solicitada → 200, UUID inexistente → 404, id inválido → 400. [VÍDEO - 403]

**Por quê**

- Achei o `findOne` com `if` aninhados difícil de ler e analisei. O `findOne` ficou com três passos, e o `canRead` é fácil de testar.

**O que quebrou**

- Um 404 com "Cannot GET /corridas/" me confundiu: era a variável `$ID` vazia no terminal, e o 404 vinha do roteador, não do meu código.

**Uso de IA**

- —

**Próximo passo**

- PATCH /corridas/:id/status

---

## 2026-11-09 (seg) — PATCH /corridas/:id/status

**O que fiz**

- O corpo recebe a ação (`aceitar`, `iniciar`, `finalizar`), e não o status de destino. As transições ficam numa constante `TRANSICOES`.

**Por quê**

- O cliente diz o que quer fazer, e o servidor decide o novo estado.

**O que quebrou**

- Bug achado no teste: finalizar uma corrida ainda não aceita dava 403 ("pertence a outro motorista") em vez de 409. O `motoristaId` era `null`, e `null !== 'motorista-1'` deu verdadeiro. Corrigi exigindo que a corrida tenha motorista antes de comparar com o motorista do token.

**Uso de IA**

- —

**Próximo passo**

- GET /corridas (listagem)

---

## 2026-11-09 (seg) — GET /corridas (listagem)

**O que fiz**

- O motorista vê as `solicitada` e as que aceitou, a mesma regra do `canRead`, só que no `WHERE`.
- Ordem diferente para cada perfil: o motorista em `ASC` e o passageiro em `DESC`.
- Apaguei o `findAll` e o `findByMotoristaId` do repository, que não eram usados. O `findAll` devolvia todas as corridas sem nenhuma regra de acesso.

**Por quê**

- Motorista em `ASC`: quem pediu primeiro é atendido primeiro. Passageiro em `DESC`: com `ASC` e `LIMIT 50`, um passageiro com muitas corridas nunca veria a atual.

**O que quebrou**

- Primeiro tentei usar o `findByMotoristaId`, mas ele deixaria de fora as solicitadas, justamente as que o motorista pode aceitar.
- Comecei a implementar paginação com `OFFSET` e desisti: o `LIMIT ?`/`OFFSET ?` costuma falhar no `execute` do mysql2, e paginação por offset fica instável numa lista que muda o tempo todo.

**Uso de IA**

- —

**Próximo passo**

- Publicação dos eventos (API)

---

## 2026-11-09 (seg) — Publicação dos eventos (API)

**O que fiz**

- Escolhi exchange topic (`corridas`) e retry com intervalo antes da DLQ.
- O evento leva a corrida inteira e um `eventId`.
- Criei uma fila de teste no painel e vi as mensagens chegando (`delivery_mode: 2`, `message_id` igual ao `eventId`). Apaguei a fila antes de tirar o print.

**Por quê**

- O motivo real do topic é deixar cada fila escolher os eventos por padrão.
- Se a publicação falhar, o cliente recebe sucesso: a corrida já está no banco, e um 500 faria o app reenviar com a mesma chave e receber 200, sem publicar nada de qualquer jeito.

**O que quebrou**

- Na primeira justificativa, disse que o topic era "o padrão" do RabbitMQ; o padrão é o direct.
- Na primeira versão mandei só o `id`, e o TypeScript não reclamou porque o `publish` aceitava qualquer objeto. Tipei o `publish` com o `CorridaEvent`, e a chave de roteamento passou a sair do próprio `tipo`.
- O Oxlint (`--type-aware`) avisou que o log ia sair como `[object Object]`. Juntei os dois `try/catch` num `publishSafely`, que registra o erro com o id da corrida.

**Uso de IA**

- —

**Próximo passo**

- Script de demonstração

---

## 2026-11-09 (seg) — Script de demonstração

**O que fiz**

- Criei o `scripts/demo.sh` com os 19 cenários da API. Ele roda dentro de um container (`docker compose run --rm demo`).

**Por quê**

- Cansado de redefinir variáveis no terminal (`$ID` e `$URL` vazios, função quebrada na colagem).
- O avaliador só precisa ter Docker.

**O que quebrou**

- Tirei os acentos das descrições: o `printf` conta bytes, e o alinhamento quebrava.

**Uso de IA**

- O Claude escreveu o `demo.sh` a partir dos cenários que eu já tinha testado à mão.

**Próximo passo**

- Worker

---

## 2026-11-09 (seg) — Worker

**O que fiz**

- O worker declara as 3 filas (principal, retry com TTL de 5 s e DLQ). A demonstração gerou os 4 eventos esperados, na ordem, e a fila ficou com 0 mensagens pendentes.

**Por quê**

- —

**O que quebrou**

- Criei o worker dentro de `api/` por engano (estava na pasta errada no CMD). Na raiz já existia uma pasta `worker/` vazia do primeiro dia. Apaguei a vazia e movi o projeto; o `mv` deu "Permission denied" até eu fechar o VS Code e o CMD.
- Erro "Nest can't resolve dependencies of the CorridasConsumer (?, ...)": faltava o `ConfigModule.forRoot()` no `app.module`. O `?` mostra qual dependência faltou.

**Uso de IA**

- O Claude gerou a estrutura do consumer (declaração das filas, retry e DLQ) e me explicou linha a linha.

**Próximo passo**

- Deduplicação no worker

---

## 2026-11-10 (ter) — Deduplicação no worker

**O que fiz**

- Implementei validação dos eventos com o Zod no worker, para conferir em tempo de execução o que chega da fila. Os eventos inválidos vão para a DLQ com o motivo e o campo explícitos no log.
- Testei publicando à mão, pelo painel do RabbitMQ, uma cópia de um evento já processado: o worker registrou "já estava no histórico" e a contagem continuou em 1.

**Por quê**

- Comparei duas opções: uma lista de eventos processados no Redis, ou o `eventId` como `_id` do histórico no Mongo. Fiquei com o Mongo: a verificação e a gravação são a mesma operação, é durável e seguro com vários workers. Com a lista no Redis, marcar o evento antes faria o retry pular o trabalho que falhou.
- Não usei `.strict()` nos eventos, ao contrário da API: se a API passar a mandar um campo novo, o worker não pode quebrar.

**O que quebrou**

- —

**Uso de IA**

- —

**Próximo passo**

- Cache no Redis

---

## 2026-11-10 (ter) — Cache no Redis

**O que fiz**

- Fiquei com um sorted set: cada estado entra com o `atualizadoEm` como pontuação, e o `zremrangebyrank` mantém só o mais recente. A ordem de chegada deixa de importar, e cada evento é uma escrita só.

**Por quê**

- O cache não pode gravar um estado mais antigo por cima de um mais novo (um evento que volta do retry). Ler, comparar e gravar no código teria a mesma janela do `SELECT` + `UPDATE`: com dois workers, o evento mais antigo poderia gravar por último.
- TTL de 24 h: cobre a corrida enquanto ela é acompanhada. Depois disso, a API busca no MySQL.

**O que quebrou**

- Bug: coloquei a atualização do cache dentro do `try` do histórico. Na duplicata, o `insertOne` lança o erro e o cache nunca seria atualizado. Separei em dois métodos, chamados um depois do outro no `process`.
- O `exec()` do ioredis não lança erro quando um comando do `multi` falha: devolve o erro dentro do resultado. Passei a conferir.

**Uso de IA**

- A IA sugeriu um script Lua, que o Redis executa de forma atômica. Rejeitei: não quis outra linguagem num projeto todo em TypeScript. Considerei o `WATCH` + transação, mas ele exige um laço de novas tentativas e uma conexão por atualização, porque o worker processa até 10 mensagens ao mesmo tempo. [IA-rejeitada]

**Próximo passo**

- `GET /corridas/:id` lendo do cache.

---

## 2026-11-10 (ter) — GET /corridas/:id lendo do cache

**O que fiz**

- O `findOne` busca primeiro no Redis (`zrange` com o último membro do sorted set) e, se não achar, no MySQL. O `canRead` roda nos dois caminhos.
- Testei com o Redis parado: a API respondeu 200 com a mesma corrida, vinda do MySQL. [VÍDEO]

**Por quê**

- O cache é otimização; o MySQL é a fonte da verdade. Se o Redis cair, a leitura não pode cair junto.
- Só o worker escreve no cache. Se a API também gravasse, o formato da chave e do JSON ficaria em dois serviços.
- O `updateStatus` continua lendo do MySQL: o cache ainda tem o estado anterior quando o evento é publicado.

**O que quebrou**

- Com o Redis parado, o log encheu de stack traces `[ioredis] Unhandled error event`: o cliente emite `error` a cada reconexão e ninguém escutava. Adicionei um listener que registra um `warn` curto.
- A mensagem do meu warn era "Reached the max retries per request limit": o ioredis enfileirava o comando e esperava as reconexões antes de falhar. Com `enableOfflineQueue: false` na API, o comando falha na hora e o GET com Redis parado caiu para 0,3 s.
- O `zrange(chave, -1, -1)` dava erro de tipo (TS2345) numa das sobrecargas do ioredis. Passei os índices como string.
- O `criadoEm` e o `atualizadoEm` voltavam como string do `JSON.parse`, apesar do tipo `Date`. Converti com `new Date()`.

**Uso de IA**

- Escrevi os métodos, `findOne` e `findInCache` e solicitei que o claude revisasse e fizesse sugestões de melhoria de código.

**Próximo passo**

- Health do worker.

---

## 2026-11-10 (ter) — Health do worker

**O que fiz**

- `/health` no worker que checa RabbitMQ, Mongo e Redis, cada ping com timeout de 2 s, e healthcheck no compose.
- Testei parando o Mongo: o worker ficou `unhealthy` com `"mongo":false` no corpo, e voltou a `healthy` sozinho quando o Mongo subiu.

**Por quê**

- No worker as três dependências são obrigatórias: sem qualquer uma, o evento não é processado.
- Na API, o health checa só o MySQL. Redis e RabbitMQ têm fallback; incluí-los faria uma queda do cache derrubar a API inteira.

**O que quebrou**

- O build e o lint passaram, mas o worker caiu ao subir: "Nest can't resolve dependencies of the HealthController (?, ...)". A injeção do Nest só é resolvida em runtime. Faltava exportar o `CorridasConsumer` do `MessagingModule` e depois o `MONGO_CLIENT` do `MongoModule`: o Nest para no primeiro parâmetro que falta, então os erros apareceram um de cada vez.
- O `healthcheck` ficou indentado dentro do `environment` no compose, e o editor acusou tipo inválido.

**Uso de IA**

- Utilizei o claude para gerar o código boiler plate do health controller .

**Próximo passo**

- Testes automatizados.


---

## 2026-11-10 (ter) — Testes unitários do service

**O que fiz**

- Testes do `CorridasService` com o repository, o publisher e o Redis mockados, instanciando o service direto, sem o módulo do Nest.
- Cenários: aceite com publicação do evento, criação com publicação do `corrida.criada`.

**Por quê**

- Unitários rodam em milissegundos, sem Docker, e entram fácil no CI. A integração de ponta a ponta já está coberta pelo `demo.sh`.

**O que quebrou**

- O Jest falhou com "Must use import to load ES Module" no `@nestjs/common`: o Nest 12 é distribuído como ESM, e o projeto é CJS. Em produção funciona porque o Node carrega ESM via `require`. No Jest, nem o Node 24 resolveu sozinho: faltava a flag `--experimental-vm-modules`, que fixei no script `test`. A alternativa era fazer o Jest transformar o `node_modules`.

**Uso de IA**

- O Claude escreveu o setup dos mocks e o primeiro teste como exemplo, para que fosse usado como base na criação dos outros testes.

**Próximo passo**

- Terminar os cenários de falha (403, 409 e leitura pelo cache) e montar o CI.


---


---

## 2026-11-11 (qua) — Testes unitários do service

**O que fiz**

- Testes do `CorridasService` com o repository, o publisher e o Redis mockados, instanciando o service direto, sem o módulo do Nest.
- Cenários: aceite com publicação do evento; criação com `corrida.criada`; repetição com a mesma chave sem segundo evento; motorista-2 finalizando corrida do motorista-1 (403); iniciar corrida solicitada (409, o bug do `null` que já tinha aparecido); passageiro-2 lendo corrida do passageiro-1 vinda do cache (403, sem consultar o MySQL).

**Por quê**

- Unitários rodam em milissegundos, sem Docker, e entram fácil no CI. A integração de ponta a ponta já está coberta pelo `demo.sh`.
- Escolhi os cenários pelo que só o meu código decide: as regras de transição, de permissão e de publicação. O que o MySQL garante (a PK da idempotência, o UPDATE atômico) fica com a demo.

**O que quebrou**

- O Jest falhou com "Must use import to load ES Module" no `@nestjs/common`: o Nest 12 é distribuído como ESM, e o projeto é CJS. Em produção funciona porque o Node carrega ESM via `require`. No Jest, nem o Node 24 resolveu sozinho: faltava a flag `--experimental-vm-modules`, que fixei no script `test`. A alternativa era fazer o Jest transformar o `node_modules`.

**Uso de IA**

- O Claude escreveu o setup dos mocks, gerando os códigos bolier plates. Também utilizei a assistência dele para padronização do código e melhorias pontuais em alguns trechos

**Próximo passo**

- CI no GitHub Actions.