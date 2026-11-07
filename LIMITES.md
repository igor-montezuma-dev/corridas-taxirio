# Limites

## O que não fiz
- Cancelamento de corrida: o desafio não pede, e ficou de fora para manter o foco no fluxo principal.
- Filtro de corridas por proximidade: todos os motoristas veem todas as corridas `solicitada`.
- Notificação em tempo real para motoristas: a UI atualiza a lista por polling. Com mais tempo, usaria WebSocket ou SSE.
- OpenTelemetry e KEDA. (A completar quando a observabilidade estiver pronta.)

## O que faria com mais tempo
- Migrations versionadas: hoje o schema é criado por um script que o MySQL só executa com o banco vazio, então mudar o schema exige recriar o banco. Em produção, usaria uma ferramenta de migrations, como o dbmate.
- UUID v7 ou `BINARY(16)` no ID da corrida, para um índice menor e inserções em ordem.
- Expiração das chaves de idempotência (TTL ou limpeza periódica).
- Rejeitar uma `Idempotency-Key` repetida com um body diferente. Hoje a corrida original é devolvida sem avisar o cliente.
- Imagem base menor para a API (por exemplo, distroless): hoje ~88% dos 265 MB são a imagem do Node.

## Riscos conhecidos
- A API confia totalmente no token: não há revogação nem verificação de que o usuário ainda existe.
- A diferença entre 403 e 404 revela quais corridas existem. O UUID reduz o risco, mas em produção eu consideraria devolver 404 nos dois casos.
- Há vulnerabilidades reportadas pelo `npm audit` em dependências de desenvolvimento (Jest, Oxlint, Nest CLI). `npm audit --omit=dev` mostra 0 em produção. Com mais tempo, atualizaria essas ferramentas e adicionaria o `npm audit --omit=dev` ao CI.