# Teste de carga (k6)

## Cenário

- Script: `loadtest/corridas.js`
- Fluxo por iteração: passageiro cria a corrida (`POST /corridas`) e consulta (`GET /corridas/:id`); motorista executa `aceitar`, `iniciar` e `finalizar` (`PATCH /corridas/:id/status`).
- Carga: rampa de 0 a 20 usuários virtuais em 30 s, 1 min em 20, descida em 15 s (1min45 no total), com 1 s de pausa por iteração.
- Ambiente: stack completa no Docker Compose, numa máquina local (WSL2).

## Resultado

| Métrica             | Valor                 |
| ------------------- | --------------------- |
| Requisições         | 7.700 (73,4 req/s)    |
| Iterações completas | 1.540                 |
| Erros HTTP          | 0,00%                 |
| Checks aprovados    | 100% (7.700 de 7.700) |

| Rota                         | Média    | p95      | Máximo    | Threshold      |
| ---------------------------- | -------- | -------- | --------- | -------------- |
| `POST /corridas`             | 19,07 ms | 34,27 ms | 169,13 ms | p95 < 500 ms ✓ |
| `GET /corridas/:id`          | 1,39 ms  | 2,23 ms  | 8,59 ms   | p95 < 200 ms ✓ |
| `PATCH /corridas/:id/status` | 16,99 ms | 29,9 ms  | 162,7 ms  | p95 < 500 ms ✓ |

Do lado do servidor (Prometheus, durante o platô):

| Métrica                         | Valor                             |
| ------------------------------- | --------------------------------- |
| Vazão do `POST` e do `GET`      | ~18,6 req/s cada                  |
| Vazão do `PATCH`                | ~55,8 req/s (3 ações por corrida) |
| p95 do atraso da fila no worker | ~45 ms                            |

## Leitura

A API e o worker sustentaram a carga sem degradar. Durante o platô de 20 usuários virtuais, a taxa de erro ficou em zero, o p95 das escritas (`POST` e `PATCH`) ficou abaixo de 35 ms e o `GET` por id respondeu em menos de 3 ms no p95.

O worker acompanhou o ritmo da API. O p95 do atraso da fila (tempo entre a publicação do evento e o início do processamento) ficou abaixo de 50 ms durante todo o teste. Se o worker fosse o gargalo, a fila acumularia e esse atraso subiria de forma contínua, o que não aconteceu.

Os p95 medidos pelo k6 e pelo Prometheus são diferentes para a mesma carga: 34 ms contra ~48 ms no `POST`, e 2,2 ms contra ~9,5 ms no `GET`. O k6 guarda a duração exata de cada requisição; o histograma do Prometheus guarda apenas a contagem por faixa (bucket) e interpola dentro dela no cálculo do quantil. Com os buckets padrão, as faixas são largas demais para uma API que responde em poucos milissegundos, e o valor sai acima do real. Na prática, o histograma serve bem para tendência e alerta, e o k6 para o número exato. Se fosse alertar em latência, eu adicionaria buckets menores (1, 2,5 e 5 ms).

## Limites do teste

- **Não encontra o limite da API.** Com 20 usuários virtuais e 1 s de pausa por iteração, o próprio script limita o ritmo a cerca de 19 iterações por segundo. O teste mostra que a API aguenta essa carga com folga, não até onde ela vai. Para isso, seria preciso uma rampa crescente até a latência ou os erros começarem a subir.
- **Não mede o efeito do cache.** O `GET` roda logo depois do `POST`, e o worker leva alguns milissegundos para gravar a corrida no Redis. Parte das leituras pode ter ido ao MySQL, e não há métrica de acerto e erro do cache para separar os dois casos.
- **Não exercita a disputa entre motoristas.** O cenário usa um único motorista, então não testa dois motoristas aceitando a mesma corrida ao mesmo tempo. Essa regra está coberta pelos testes unitários e pela demo, não pela carga.
- **Roda numa máquina só.** Todos os serviços estão no mesmo Docker Compose, em ambiente local, sem a latência de rede de um ambiente real.

## Como reproduzir

Veja a seção "Teste de carga" do README.
