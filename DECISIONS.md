# Decisões técnicas

Registro das decisões relevantes: contexto, alternativas consideradas, escolha e trade-off aceito.

---

## 1. Autenticação: identidade do JWT, verificado com RS256 e chave pública

**Contexto:** O desafio exige JWT com token estático, regras por perfil e validação por JWKS ou chave pública. Não pede cadastro nem login.
**Alternativas:** Tabela de usuários com login próprio (fora do escopo); provedor de identidade externo (o cenário real, mas um serviço a mais sem agregar à avaliação). Para a assinatura: HS256, em que o mesmo segredo assina e verifica, então a API também conseguiria criar tokens; RS256 com JWKS, que exige mais um serviço no compose.
**Escolha:** `passageiro_id` e `motorista_id` vêm do `sub` do token, como `VARCHAR` e sem FK. A assinatura é RS256, e a API recebe só a chave pública, montada como arquivo; a verificação fixa o algoritmo (`RS256`), o emissor e a audiência. Só quem emite os tokens tem a chave privada, então a API não consegue fabricar tokens, mesmo se for invadida.
**Trade-off:** Não há integridade referencial nem como saber se o usuário ainda existe; a API confia no token até ele expirar. Trocar a chave exige reimplantar a API e invalida os tokens já emitidos; o JWKS, com chaves identificadas pelo `kid`, evitaria isso (LIMITES.md). O par de chaves de teste fica versionado, com nome que deixa claro que é só de teste.

## 2. UUID como id e 403 para corrida de outro usuário

**Contexto:** O id da corrida aparece na URL, e o desafio pede para demonstrar o 403. Com ids sequenciais, a diferença entre 403 e 404 revelaria quais corridas existem.
**Alternativas:** `AUTO_INCREMENT` (previsível, permite enumeração); UUID v7 ou `BINARY(16)` (melhor para o índice, mas exige conversão na aplicação); 404 para tudo o que não pertence ao usuário.
**Escolha:** UUID em `CHAR(36)`. 403 quando a corrida existe e não é do usuário; 404 quando não existe. O 403 é a proteção real; o UUID é uma camada a mais contra enumeração.
**Trade-off:** Índice maior e inserções fora de ordem; em produção usaria UUID v7 ou `BINARY(16)`. A diferença entre 403 e 404 ainda revela que um id existe; em produção consideraria 404 nos dois casos.

## 3. Persistência: MySQL com SQL puro como fonte da verdade, Mongo para o histórico

**Contexto:** As partes centrais do desafio (aceite concorrente e idempotência) dependem do que o MySQL devolve: `affectedRows` e `ER_DUP_ENTRY` (1062). A corrida tem quatro estados fixos. O histórico de eventos só recebe inserções e é consultado por corrida.
**Alternativas:** Prisma, que gera os tipos, mas traduz o resultado (`count`, `P2002`) e exige `prisma generate` no Dockerfile e no CI; TypeORM, mais perto do SQL, mas com as entidades escritas à mão do mesmo jeito. Para o status: `VARCHAR` (aceita qualquer texto), `TINYINT` (o significado só existe no código) ou tabela com FK (complexidade a mais para quatro valores estáveis). Para o histórico: uma tabela no próprio MySQL.
**Escolha:** MySQL com mysql2 e SQL puro, sempre com placeholders (`?`), para ter controle do que é executado e defender o SQL no vídeo e na entrevista. O status é um `ENUM` com modo SQL estrito, para o banco recusar valores inválidos. O histórico fica no MongoDB, um documento por evento, com índice por corrida e data: é um log de auditoria que só cresce, separado da fonte da verdade, e o `_id` do documento serve para deduplicar (decisão 5).
**Trade-off:** Tipagem manual (tipos e conversão de `snake_case` para `camelCase`). Mudar o conjunto de estados exige `ALTER TABLE`. O schema é criado por um script que o MySQL só executa com o banco vazio: não há migrations versionadas (LIMITES.md). Dois bancos para operar em vez de um.

## 4. Concorrência no aceite: UPDATE condicional

**Contexto:** Vários motoristas podem aceitar a mesma corrida ao mesmo tempo; o primeiro ganha.
**Alternativas:** `SELECT` seguido de `UPDATE` (deixa uma janela entre ler e gravar); comparar timestamps (ainda exige ler antes de gravar); `CASE` no `SET` (o `WHERE id = ?` sempre encontra a linha, e os dois receberiam `affectedRows = 1`).
**Escolha:** `UPDATE corridas SET status='aceita', motorista_id=? WHERE id=? AND status='solicitada'`. `affectedRows` 1 → 200 e publica o evento; 0 → a API lê a corrida para responder 404, 403 ou 409. O MySQL decide, o RabbitMQ avisa e o worker copia.
**Trade-off:** Uma consulta extra no caso de 0 linhas para escolher a resposta certa.

## 5. Idempotência nas duas pontas, garantida pelo banco

**Contexto:** O `POST /corridas` pode ser reenviado em retries do cliente, e o RabbitMQ entrega cada mensagem pelo menos uma vez (at-least-once), então o worker pode receber o mesmo evento de novo.
**Alternativas:** Na API, uma coluna na tabela `corridas`, ou `SELECT` antes do `INSERT` (tem a mesma janela da decisão 4). No worker, uma lista de eventos processados no Redis, marcada antes ou depois do processamento.
**Escolha:** Nos dois lados, quem garante é uma chave única no banco, e a aplicação só decide o que fazer com a duplicata. Na API, a tabela `idempotency_keys` com `PRIMARY KEY (passageiro_id, chave)`, gravada na mesma transação da corrida; em `ER_DUP_ENTRY`, a API devolve a corrida existente com 200, sem publicar outro evento. O InnoDB faz a requisição concorrente esperar o commit, então não há estado "em processamento". No worker, o `eventId` é o `_id` do documento de histórico no Mongo: a verificação e a gravação são a mesma operação. Na duplicata (código 11000), o worker segue para o cache, porque a atualização do cache também é idempotente.
**Trade-off:** Uma tabela a mais na API. As chaves não expiram, e um body diferente com a mesma chave devolve a corrida original (LIMITES.md). Com a lista no Redis, marcar antes faria o retry pular o trabalho que falhou, e marcar depois deixaria uma janela para duplicar.

## 6. Topologia do RabbitMQ: exchange topic, retry com intervalo e DLQ

**Contexto:** A API publica `corrida.criada` e `corrida.status_alterado`. O worker consome os dois, e futuros consumidores podem querer só um deles. Falhas no worker podem ser passageiras (Mongo reiniciando) ou permanentes (mensagem mal formada).
**Alternativas:** Exchange direct, que exige a chave exata e um binding para cada evento; fanout, que entrega todos os eventos a todas as filas e passa o filtro para o consumidor. Para falhas, DLQ direta, que manda para a mesma fila tanto o erro que se resolveria sozinho quanto o erro real.
**Escolha:** Exchange `corridas` do tipo topic, e a fila do worker assinando `corrida.*`. Em caso de falha, a mensagem vai para uma fila de retry com TTL de 5 s, que a devolve à fila principal; depois de 3 tentativas, vai para a DLQ. Mensagens que nunca vão funcionar (JSON inválido ou fora do schema) vão direto para a DLQ. Ack manual, só depois de processar ou de confirmar o envio para o retry ou a DLQ.
**Trade-off:** Mais complexidade: uma fila a mais e a contagem de tentativas num cabeçalho. Uma mensagem com erro passageiro que não se resolve leva cerca de 10 s para chegar à DLQ. E uma mensagem que volta do retry pode chegar depois de um evento mais novo da mesma corrida, o que levou à decisão 7.

## 7. Cache: cache-aside na leitura, escrito só pelo worker

**Contexto:** O `GET /corridas/:id` deve usar cache. Os eventos podem chegar fora de ordem (retry) e repetidos (at-least-once). O Redis pode cair.
**Alternativas:** Write-through, com a API gravando no cache junto com o MySQL (o formato do cache ficaria em dois serviços); cache-aside clássico, com a API gravando no cache depois de um miss; no worker, ler, comparar e gravar no código (mesma janela da decisão 4), um script Lua ou `WATCH` com transação.
**Escolha:** A API lê do Redis e, num miss ou numa falha, busca no MySQL; o `canRead` roda nos dois caminhos. Só o worker escreve no cache, a partir dos eventos. Cada corrida é um sorted set em que o membro é o snapshot e a pontuação é o `atualizadoEm`; o `zremrangebyrank` mantém só o mais recente, então a ordem de chegada deixa de importar. TTL de 24 h. A escrita de status (`PATCH`) sempre lê o MySQL.
**Trade-off:** Consistência eventual: logo após uma mudança, o cache pode estar alguns milissegundos atrás, e o `canRead` roda sobre esse snapshot. Com o Redis fora, toda a leitura cai no MySQL. Rejeitei o Lua por não querer outra linguagem no projeto, e o `WATCH` por exigir um laço de novas tentativas e uma conexão por atualização.

## 8. Manteria o RabbitMQ num sistema do zero?

**Contexto:** O sistema publica eventos de corrida que hoje têm um consumidor (o worker) e podem ganhar outros (notificações, faturamento, analytics), cada um interessado em parte dos eventos. As falhas no consumo podem ser passageiras ou permanentes. Não há requisito de reprocessar o histórico de eventos nem de ordem estrita: a ordem do cache é resolvida pelo `atualizadoEm` (decisão 7).
**Alternativas:** Kafka (log persistente com replay e ordem por partição, mas mais peças para operar e sem retry nem DLQ prontos); BullMQ (o Redis já está no projeto, mas é uma fila de jobs para um consumidor por job, pensada para o ecossistema Node, e misturaria a mensageria com o cache); SQS com SNS (sem operação, mas preso a um provedor de nuvem e sem rodar localmente sem emulador).
**Escolha:** Manteria o RabbitMQ. Ele entrega o que o sistema precisa com recursos do próprio broker: roteamento por tópico para vários consumidores, ack por mensagem, retry com TTL e DLQ, e métricas por fila para o Prometheus, para que rode em um container só.
**Trade-off:** Não há replay: uma mensagem consumida sai da fila, e um consumidor novo não recebe os eventos antigos (o histórico no Mongo cobre a auditoria). Trocaria pelo Kafka se replay ou ordem por corrida virassem requisitos, ou se o volume de eventos passasse do que um cluster RabbitMQ atende bem.