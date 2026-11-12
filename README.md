# corridas

Versão simplificada do fluxo central do Taxi.Rio: passageiros solicitam corridas, motoristas aceitam, iniciam e finalizam, e o sistema acompanha o status em tempo quase real.

```
[UI React] ──HTTP+JWT──▶ [API NestJS] ──▶ MySQL (fonte da verdade)
                              │
                              └─ publica evento ─▶ [RabbitMQ] ──▶ [Worker NestJS]
                                                                     │
                                         Redis (cache de status) ◀───┤
                                         MongoDB (histórico) ◀───────┘

Prometheus coleta /metrics da API, do worker e do RabbitMQ, e avalia os alertas.
```

## Sumário

- [Como subir](#como-subir)
- [Como testar o fluxo](#como-testar-o-fluxo)
- [Testes automatizados e CI](#testes-automatizados-e-ci)
- [Como validar a observabilidade](#como-validar-a-observabilidade)
- [O que foi entregue](#o-que-foi-entregue)
- [Documentação](#documentação)
- [Uso de IA](#uso-de-ia)

## Como subir

Pré-requisito: Docker com o Docker Compose. Os comandos abaixo são para bash (Linux, macOS, WSL ou Git Bash).

```bash
git clone https://github.com/igor-montezuma-dev/corridas-taxirio.git
cd corridas-taxirio
cp .env.example .env
docker compose up -d --build
```

O `.env.example` tem apenas credenciais de teste. A primeira subida leva alguns minutos (build das imagens e inicialização do MySQL). Para acompanhar:

```bash
docker compose ps
```

Todos os serviços devem aparecer como `healthy` (o Prometheus e a UI não têm healthcheck e aparecem só como `running`).

| Serviço | Endereço |
|---|---|
| UI | http://localhost:8080 |
| API | http://localhost:3000 |
| Worker (`/health`, `/metrics`) | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| RabbitMQ (painel) | http://localhost:15672 (usuário `corridas`, senha `corridas_test_only`) |

Portas usadas no host: 3000, 3001, 3307 (MySQL), 5672, 6379, 8080, 9090, 15672 e 27017.

Para parar e apagar os dados:

```bash
docker compose down -v
```

## Como testar o fluxo

### Demonstração automática da API

Um script roda 19 cenários contra a API e mostra o status esperado e o recebido em cada um: 401 sem token e com token inválido, criação, idempotência, 403 por perfil e por dono, 404, 409 de transição inválida e o fluxo completo de aceitar, iniciar e finalizar.

```bash
docker compose run --rm demo
```

### Tokens de teste

Não há login: a API valida tokens RS256 com a chave pública de teste (`keys/test-fixtures/`). Para gerar os tokens dos quatro usuários de teste (`passageiro-1`, `passageiro-2`, `motorista-1` e `motorista-2`):

```bash
docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/generate-token.mjs
```

No Git Bash do Windows, coloque `MSYS_NO_PATHCONV=1` antes do `docker run`, para ele não converter os caminhos `/app`.

Para guardar um deles numa variável:

```bash
TOKEN_P1=$(docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/generate-token.mjs | grep -A1 "passageiro-1" | tail -1)
```

### UI

Abra http://localhost:8080 e cole um dos tokens.

1. Como `passageiro-1`, peça uma corrida. Em seguida, use "Reenviar o último pedido (mesma chave)": a resposta é `200` e nenhuma corrida nova é criada (idempotência).
2. Abra mais duas abas, uma como `motorista-1` e outra como `motorista-2`. As duas mostram a corrida como `Solicitada`, com o botão "Aceitar".
3. Clique em "Aceitar" na aba do `motorista-1` e, logo em seguida (antes de 3 s), na do `motorista-2`: o segundo recebe `409`, porque a corrida já foi aceita. Depois do próximo polling, ela some da lista do `motorista-2`, que só vê corridas solicitadas e as próprias.
4. Na aba do `motorista-1`, inicie e finalize. A aba do passageiro atualiza sozinha em até 3 s.

O aceite concorrente também é coberto pela demonstração automática (`docker compose run --rm demo`).

Detalhes da UI e das decisões dela em [`ui/README.md`](ui/README.md).

### Chamadas diretas à API

```bash
# Criar corrida (201), e repetir com a mesma chave (200, mesma corrida)
curl -s -i -X POST http://localhost:3000/corridas \
  -H "Authorization: Bearer $TOKEN_P1" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: exemplo-1" \
  -d '{"origem":"Centro","destino":"Barra"}'

# Listar as corridas do passageiro
curl -s http://localhost:3000/corridas -H "Authorization: Bearer $TOKEN_P1"
```

| Rota | Quem pode | Observação |
|---|---|---|
| `POST /corridas` | passageiro | Exige o header `Idempotency-Key` |
| `GET /corridas/:id` | passageiro (só as próprias), motorista (solicitadas e as que aceitou) | Lê do cache no Redis, com fallback para o MySQL |
| `GET /corridas` | passageiro, motorista | Mesmas regras de leitura |
| `PATCH /corridas/:id/status` | motorista | Corpo `{"acao": "aceitar" \| "iniciar" \| "finalizar"}` |

## Testes automatizados e CI

Testes unitários do service da API, do processor e do consumer do worker, e das funções puras da UI. A integração com MySQL, RabbitMQ, Redis e MongoDB é coberta pela demonstração acima.

O CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda lint, testes e build da API, do worker e da UI a cada push e pull request, e depois constrói as três imagens Docker.

Para rodar localmente, com Node 24:

```bash
cd api && npm ci && npm test && cd ..
cd worker && npm ci && npm test && cd ..
cd ui && npm ci && npm test && cd ..
```

O `npm ci` reporta vulnerabilidades e pacotes descontinuados. Todos estão em ferramentas de desenvolvimento (Jest, Oxlint, Nest CLI), que não vão para as imagens: `npm audit --omit=dev` mostra 0 em produção (veja o [`LIMITES.md`](LIMITES.md)).

## Como validar a observabilidade

### Logs com correlation_id de ponta a ponta

Os logs da API e do worker saem em JSON. A API aceita o header `X-Request-Id` (ou gera um UUID), devolve o id na resposta, e o mesmo id viaja na propriedade `correlationId` da mensagem do RabbitMQ até o worker, inclusive no retry e na DLQ.

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://localhost:3000/corridas \
  -H "Authorization: Bearer $TOKEN_P1" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: rastro-$(date +%s)" \
  -H "X-Request-Id: teste-rastro-1" \
  -d '{"origem":"Centro","destino":"Barra"}'
sleep 2
docker compose logs api worker | grep teste-rastro-1
```

O mesmo `correlation_id` aparece na linha da requisição na API e na linha do processamento no worker.

### Métricas

```bash
curl -s http://localhost:3000/metrics | grep '^http_requests_total'
curl -s http://localhost:3001/metrics | grep -E '^events_processed_total|^event_queue_delay'
```

| Métrica | Onde | O que mede |
|---|---|---|
| `http_requests_total` | API | Requisições por método, rota (padrão, como `/corridas/:id`) e status: taxa e erros |
| `http_request_duration_seconds` | API | Latência (histograma) |
| `events_processed_total` | Worker | Eventos por tipo e resultado (`success`, `retry`, `dlq`, `invalid`) |
| `event_processing_duration_seconds` | Worker | Tempo de processamento (histograma) |
| `event_queue_delay_seconds` | Worker | Atraso: tempo entre a mudança da corrida e o processamento (histograma) |
| `rabbitmq_detailed_queue_messages_ready` | RabbitMQ | Tamanho de cada fila (principal, retry e DLQ) |

No Prometheus (http://localhost:9090/targets), os alvos `api`, `worker`, `rabbitmq` e `rabbitmq-filas` devem estar `UP`.

### Alertas

Dois alertas, em [`observability/alerts.yml`](observability/alerts.yml) (carregado pelo Prometheus do compose) e, com os mesmos `groups`, em [`observability/alerts-prometheusrule.yaml`](observability/alerts-prometheusrule.yaml):

- **ApiTaxaDeErros5xxAlta:** mais de 5% das requisições da API com 5xx por 5 minutos.
- **EventosNaDlq:** qualquer evento enviado para a DLQ nos últimos 10 minutos.

A justificativa dos dois e dos limiares está em [`observability/ALERTAS.md`](observability/ALERTAS.md).

Para ver o alerta da DLQ disparar, publique uma mensagem inválida pela API HTTP do RabbitMQ:

```bash
curl -s -u corridas:corridas_test_only -H "content-type: application/json" \
  -X POST http://localhost:15672/api/exchanges/%2F/corridas/publish \
  -d '{"properties":{"correlation_id":"teste-alerta-dlq"},"routing_key":"corrida.criada","payload":"isso nao e json","payload_encoding":"string"}'
```

Em até cerca de 30 s, o `EventosNaDlq` aparece como `Firing` em http://localhost:9090/alerts, e o worker registra a mensagem com o `correlation_id` `teste-alerta-dlq`:

```bash
docker compose logs worker | grep teste-alerta-dlq
```

Se o worker tiver acabado de subir, espere uns 30 s antes de publicar, para o Prometheus registrar o contador zerado.

## O que foi entregue

| Parte | Situação |
|---|---|
| **1. Fundação** | Completa: compose com todos os serviços, JWT (401 e 403), idempotência no `POST`, tolerância a mensagem duplicada no worker, testes automatizados e CI. |
| **2. Operar** | Logs JSON com `correlation_id` da API ao worker; métricas na API e no worker (taxa, latência, erros, tamanho e atraso da fila); dois alertas com justificativa. Sem OpenTelemetry e sem k6. |
| **3. Kubernetes** | Não implementada. |

O que ficou de fora, e por quê, está em [`LIMITES.md`](LIMITES.md).

## Documentação

- [`DECISIONS.md`](DECISIONS.md): as decisões técnicas, com alternativas e trade-offs, incluindo a decisão sobre o RabbitMQ.
- [`DIARIO.md`](DIARIO.md): o diário do desenvolvimento, com o que quebrou e como foi investigado.
- [`LIMITES.md`](LIMITES.md): o que não foi feito, o que faria com mais tempo e os riscos conhecidos.
- [`ui/README.md`](ui/README.md): a estrutura e as decisões da UI.
- [`observability/ALERTAS.md`](observability/ALERTAS.md): a justificativa dos alertas.

## Uso de IA

Usei o Claude (Anthropic) como assistente durante o desafio:

- **Código boilerplate:** `docker-compose.yml`, Dockerfiles, workflow do CI, scripts de token e de demonstração, estrutura inicial do consumer do RabbitMQ, configuração do Pino e do Prometheus e setup dos mocks dos testes.
- **Validação de erros:** ajudou a investigar os problemas que surgiram, como o Jest com o Nest 12 distribuído em ESM, a injeção de dependências do Nest e o alerta da DLQ que não disparava.
- **Correções pontuais:** revisou o código que escrevi e sugeriu ajustes para manter o código limpo e seguir SOLID e DRY.
- **UI:** a interface foi gerada a partir dos requisitos e da estrutura que defini (camadas, TanStack Query, toasts, Tailwind); revisei o código e separei a camada de API.
- **Documentação:** ajudou a redigir e organizar o `DECISIONS.md`, o `LIMITES.md` e o `observability/ALERTAS.md` a partir das decisões que tomei.

Os campos "Uso de IA" do [`DIARIO.md`](DIARIO.md) detalham o uso em cada etapa.

**Uma sugestão que rejeitei:** para impedir que um evento antigo, vindo do retry, sobrescrevesse um estado mais novo no cache, a IA sugeriu um script Lua, que o Redis executa de forma atômica. Rejeitei porque não quis outra linguagem num projeto todo em TypeScript. Também descartei o `WATCH` com transação, que exigiria um laço de novas tentativas e uma conexão por atualização. Fiquei com um sorted set, em que a pontuação é o `atualizadoEm` da corrida e só o mais recente é mantido (decisão 7 do [`DECISIONS.md`](DECISIONS.md)).

**Uma correção que precisei fazer:** perto do fim, a IA indicou que a Parte 2 estava completa, com base no resumo do que tínhamos combinado. Relendo o enunciado, encontrei itens que faltavam (tamanho e atraso da fila, o caminho do `PrometheusRule` e a justificativa dos alertas) e os implementei.
