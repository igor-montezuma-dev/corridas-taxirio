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
- Rotação de chaves do JWT sem invalidar tokens: aceitar mais de uma chave pública, escolhida pelo `kid` do token, ou usar JWKS.
- Retry do aceite pelo mesmo motorista: se ele aceitou e perdeu a resposta, o reenvio recebe 409. O ideal seria responder 200 quando a corrida já está aceita por ele.
- Documentação da API com Swagger/OpenAPI. Com o Zod, exigiria uma biblioteca para converter os schemas ou descrevê-los à mão.
- Paginação na listagem: hoje há um limite fixo de 50 corridas. Paginação por OFFSET seria instável numa lista que muda o tempo todo (quando uma corrida é aceita, as seguintes mudam de página); em produção, usaria paginação por cursor (`WHERE criado_em > ?`).
- A lista do motorista acumula todas as corridas que ele já finalizou. Num app real, ela mostraria só as ativas, e o histórico ficaria em outra tela.
- O tipo do evento está duplicado na API e no worker. Com mais serviços, eu documentaria o formato do evento como um contrato versionado (um schema JSON e um campo de versão no evento), em vez de compartilhar código, para os serviços continuarem evoluindo de forma independente.
- O `/health` da API checa só o MySQL. Redis e RabbitMQ ficam de fora de propósito: a API tem fallback para os dois, e incluí-los transformaria uma queda do cache numa queda da API inteira. Uma versão melhor devolveria o estado de cada dependência no corpo (`degraded`) sem mudar o status HTTP, e separaria liveness de readiness no Kubernetes.

## Riscos conhecidos

- A API confia totalmente no token: não há revogação nem verificação de que o usuário ainda existe.
- A diferença entre 403 e 404 revela quais corridas existem. O UUID reduz o risco, mas em produção eu consideraria devolver 404 nos dois casos.
- Há vulnerabilidades reportadas pelo `npm audit` em dependências de desenvolvimento (Jest, Oxlint, Nest CLI). `npm audit --omit=dev` mostra 0 em produção. Com mais tempo, atualizaria essas ferramentas e adicionaria o `npm audit --omit=dev` ao CI.
- A publicação do evento acontece depois do COMMIT, sem transação entre o MySQL e o RabbitMQ. Se ela falhar, a corrida fica correta no banco, mas o evento se perde (fica só o log do erro), e o Redis e o Mongo ficam desatualizados. A solução de produção é o padrão outbox.
- O `GET /corridas/:id` aplica o `canRead` sobre o snapshot do cache, que tem consistência eventual. Logo após um aceite, outro motorista pode ainda ler a corrida por alguns milissegundos, até o worker atualizar o cache. Para eliminar a janela, a checagem de permissão teria que ir sempre ao MySQL.
