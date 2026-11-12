# Alertas

As regras estão em `alerts.yml` (carregado pelo Prometheus do compose, visível em http://localhost:9090/alerts) e, com os mesmos `groups`, em `alerts-prometheusrule.yaml` (formato do Prometheus Operator).

## Por que esses dois

Os dois cobrem as duas metades do fluxo, cada um pelo sintoma que o usuário sente:

- **ApiTaxaDeErros5xxAlta**: o lado síncrono. Se a API falha, passageiros não conseguem pedir corrida e motoristas não conseguem aceitar.
- **EventosNaDlq**: o lado assíncrono. Uma falha no worker não aparece na API (o POST continua respondendo 201), mas o histórico e o cache daquela corrida ficam desatualizados. Sem esse alerta, o problema seria silencioso.

Preferi alertar sobre sintomas (erros que o usuário vê, eventos perdidos) e não sobre causas (CPU, memória, conexões), que geram ruído e nem sempre afetam alguém.

## ApiTaxaDeErros5xxAlta

`sum(rate(5xx[5m])) / sum(rate(total[5m])) > 0.05` por `5m`. Severidade `critical`.

- **Proporção, não número absoluto:** 10 erros em mil requisições é 1%; 10 erros em 20 é 50%. O número sozinho não diferencia os dois casos.
- **Só 5xx:** 4xx são erros do cliente (token inválido, 403, 409 de aceite concorrente) e fazem parte do funcionamento normal.
- **5%:** acima do ruído de erros isolados (um timeout eventual), abaixo do ponto em que muitos usuários já foram afetados. É um ponto de partida; o valor certo sai de observar a taxa normal em produção.
- **for: 5m:** um pico de segundos, como um deploy ou um reinício, não deve acordar ninguém. Cinco minutos seguidos indicam um problema que não se resolveu sozinho.

## EventosNaDlq

`sum(increase(events_processed_total{result=~"dlq|invalid"}[10m])) > 0`, sem `for`. Severidade `warning`.

- **Limiar zero:** cada evento na DLQ é uma corrida com histórico ou cache desatualizado. Não existe quantidade aceitável.
- **Sem `for`:** a mensagem já passou por 3 tentativas com 5 s de intervalo antes de chegar à DLQ; esperar mais não muda nada.
- **warning, não critical:** a API continua funcionando e o MySQL tem o estado correto. Alguém precisa investigar, mas não de madrugada.
- **Janela de 10 minutos:** mantém o alerta visível tempo suficiente para alguém ver, e ele volta sozinho a inativo quando não chegam novos eventos.
- **Como investigar:** o `correlation_id` da mensagem aparece no log do worker na linha que a mandou para a DLQ.

## O que foi preciso corrigir

O alerta da DLQ não disparou no primeiro teste: a série do contador só passava a existir no primeiro evento, já com valor 1, e o `increase` não via o salto de 0 para 1. O worker passou a criar as séries com valor 0 na inicialização.