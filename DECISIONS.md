# Decisões técnicas

Registro das decisões relevantes: contexto, alternativas consideradas, escolha e trade-off aceito.

---

## 1. Identidade vem do JWT, sem tabela de usuários
**Contexto:** O desafio exige JWT e regras por perfil, mas não pede cadastro nem login.
**Alternativas:** Tabela de usuários com login próprio (cadastro e senha fora do escopo); provedor de identidade externo (o cenário real, mas um serviço a mais sem agregar à avaliação).
**Escolha:** `passageiro_id` e `motorista_id` vêm do `sub` do JWT, como `VARCHAR` e sem FK.
**Trade-off:** Não há integridade referencial nem como verificar se o usuário existe; a API confia no token.

## 2. UUID como ID da corrida
**Contexto:** O ID aparece na URL. Com IDs sequenciais, a diferença entre 403 e 404 revelaria quais corridas existem.
**Alternativas:** `AUTO_INCREMENT` (previsível, permite enumeração); UUID v7 ou `BINARY(16)` (melhor para o índice, mas exige conversão na aplicação).
**Escolha:** UUID em `CHAR(36)`. O 403 é a proteção real; o UUID é uma camada a mais contra enumeração.
**Trade-off:** Índice maior e inserções fora de ordem. Em produção usaria UUID v7 ou `BINARY(16)` (LIMITES.md).

## 3. Status como ENUM no MySQL
**Contexto:** A corrida tem quatro estados fixos e o banco deve recusar valores inválidos.
**Alternativas:** `VARCHAR` (aceita qualquer texto); `TINYINT` (o significado dos números só existe no código); tabela de status com FK (complexidade a mais para quatro valores estáveis).
**Escolha:** `ENUM` com modo SQL estrito.
**Trade-off:** Mudar o conjunto de estados exige `ALTER TABLE`.

## 4. Concorrência no aceite: UPDATE condicional
**Contexto:** Vários motoristas podem aceitar a mesma corrida ao mesmo tempo; o primeiro ganha.
**Alternativas:** Coluna de timestamp; `CASE` no `SET`.
**Escolha:** `UPDATE corridas SET status='aceita', motorista_id=? WHERE id=? AND status='solicitada'`. `affectedRows` 1 → 200 e publica o evento; 0 → 409, ou 404 se a corrida não existir. O MySQL decide, o RabbitMQ avisa e o worker copia.
**Trade-off:** Uma consulta extra no caso de 0 linhas para distinguir 404 de 409.

## 5. Idempotência em tabela separada com chave primária composta
**Contexto:** O `POST /corridas` pode ser reenviado em retries. A UI gera a `Idempotency-Key` antes da primeira tentativa.
**Alternativas:** Coluna na tabela `corridas`; `SELECT` antes do `INSERT`.
**Escolha:** Tabela `idempotency_keys (passageiro_id, chave, corrida_id FK, criado_em)` com `PRIMARY KEY (passageiro_id, chave)`, gravada na mesma transação da corrida. Tento o `INSERT` e, em `ER_DUP_ENTRY` (1062), devolvo a corrida existente. O InnoDB faz a requisição concorrente esperar o COMMIT, então não preciso de estado "em processamento".
**Trade-off:** Uma tabela a mais e dois INSERTs que precisam estar na mesma transação. Aceito pela separação de responsabilidades (idempotência é do protocolo, não do domínio) e pelo reuso no PATCH. As chaves não expiram, e um body diferente com a mesma chave devolve a corrida original; os dois pontos ficam no LIMITES.md.

## 6. 403 em vez de 404 para corrida de outro usuário
**Contexto:** O desafio pede para demonstrar o 403.
**Alternativas:** 404 para tudo o que não pertence ao usuário.
**Escolha:** 403 quando a corrida existe e não é do usuário; 404 quando não existe.
**Trade-off:** Revela quais corridas existem; o UUID reduz esse risco. Em produção consideraria 404.

## 7. Acesso ao banco com SQL puro (mysql2), sem ORM
**Contexto:** As partes centrais do desafio (aceite concorrente e idempotência) dependem do que o MySQL devolve: `affectedRows` e `ER_DUP_ENTRY` (1062). O schema tem só duas tabelas, e as queries vão aparecer no vídeo de apresentação.
**Alternativas:** Prisma, que gera os tipos sozinho, mas traduz o resultado (`count`, `P2002`) e exige `prisma generate` no Dockerfile e no CI; TypeORM, que fica mais perto do SQL, mas exige escrever as entidades à mão do mesmo jeito; Prisma ou dbmate só para as migrations, descartados por acrescentar uma etapa que precisa rodar antes da API.
**Escolha:** SQL puro com mysql2, para ter controle do que é executado e defender o SQL que estudei, sem uma camada de tradução no meio. Também reduz as peças que o avaliador precisa subir do zero.
**Trade-off:** Tipagem manual (tipos e conversão de `snake_case` para `camelCase`) e a disciplina de usar sempre placeholders (`?`) para evitar SQL injection. O schema é criado por um script que o MySQL só executa com o banco vazio: não há migrations versionadas, e mudar o schema exige recriar o banco (LIMITES.md).

## 8. Manteria o RabbitMQ num sistema do zero?
_A preencher depois de implementar o fluxo com o broker._
