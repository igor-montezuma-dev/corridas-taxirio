#!/usr/bin/env bash
# Demonstra o fluxo completo da API e confere o código HTTP de cada cenario.
# Uso (na raiz do projeto, com o compose no ar): bash scripts/demo.sh
set -euo pipefail

URL="${API_URL:-http://localhost:3000}"
CHAVE="demo-$(date +%s)"
JSON='Content-Type: application/json'
FALHAS=0
CORPO=''

# --- Tokens de teste ----------------------------------------------------------
TOKENS=$(node scripts/generate-token.mjs)
token() { echo "$TOKENS" | grep -A1 "^# $1 " | tail -n1; }
P1=$(token passageiro-1)
P2=$(token passageiro-2)
M1=$(token motorista-1)
M2=$(token motorista-2)
auth() { echo "Authorization: Bearer $1"; }

# --- Verificação ---------------------------------------------------------------
# check <descrição> <status esperado> <argumentos do curl...>
check() {
  local descricao="$1" esperado="$2"
  shift 2
  local resposta status
  resposta=$(curl -s -w '\n%{http_code}' "$@")
  status=$(echo "$resposta" | tail -n1)
  CORPO=$(echo "$resposta" | sed '$d')
  if [ "$status" = "$esperado" ]; then
    printf '  [OK]     %-50s %s\n' "$descricao" "$status"
  else
    printf '  [FALHOU] %-50s esperado %s, veio %s\n' "$descricao" "$esperado" "$status"
    echo "           $CORPO"
    FALHAS=$((FALHAS + 1))
  fi
}

# status <descrição> <status esperado> <token> <ação>
status() {
  check "$1" "$2" -X PATCH "$URL/corridas/$ID/status" -H "$(auth "$3")" -H "$JSON" \
    -d "$(printf '{"acao":"%s"}' "$4")"
}

# --- Fluxo ----------------------------------------------------------------------
echo "Autenticacao"
check "Sem token" 401 "$URL/corridas"
check "Token invalido" 401 -H "$(auth token-invalido)" "$URL/corridas"

echo "Criacao (POST /corridas)"
check "Passageiro cria corrida" 201 -X POST "$URL/corridas" -H "$(auth "$P1")" -H "$JSON" \
  -H "Idempotency-Key: $CHAVE" -d '{"origem":"Centro","destino":"Barra"}'
ID=$(echo "$CORPO" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
echo "           corrida criada: $ID"
check "Mesma Idempotency-Key devolve a mesma corrida" 200 -X POST "$URL/corridas" -H "$(auth "$P1")" \
  -H "$JSON" -H "Idempotency-Key: $CHAVE" -d '{"origem":"Centro","destino":"Barra"}'
check "Motorista tenta criar" 403 -X POST "$URL/corridas" -H "$(auth "$M1")" -H "$JSON" \
  -H "Idempotency-Key: $CHAVE-m" -d '{"origem":"Centro","destino":"Barra"}'
check "Sem Idempotency-Key" 400 -X POST "$URL/corridas" -H "$(auth "$P1")" -H "$JSON" \
  -d '{"origem":"Centro","destino":"Barra"}'
check "Campo extra no corpo" 400 -X POST "$URL/corridas" -H "$(auth "$P1")" -H "$JSON" \
  -H "Idempotency-Key: $CHAVE-x" -d '{"origem":"Centro","destino":"Barra","status":"finalizada"}'

echo "Leitura (GET /corridas/:id)"
check "Dono le a corrida" 200 -H "$(auth "$P1")" "$URL/corridas/$ID"
check "Outro passageiro tenta ler" 403 -H "$(auth "$P2")" "$URL/corridas/$ID"
check "Motorista le corrida solicitada" 200 -H "$(auth "$M1")" "$URL/corridas/$ID"
check "Corrida inexistente" 404 -H "$(auth "$P1")" "$URL/corridas/00000000-0000-4000-8000-000000000000"

echo "Transicoes (PATCH /corridas/:id/status)"
status "Passageiro tenta aceitar" 403 "$P1" aceitar
status "Finalizar antes de aceitar" 409 "$M1" finalizar
status "Motorista 1 aceita" 200 "$M1" aceitar
status "Motorista 2 tenta aceitar (chegou tarde)" 409 "$M2" aceitar
status "Motorista 2 tenta iniciar (corrida de outro)" 403 "$M2" iniciar
status "Motorista 1 inicia" 200 "$M1" iniciar
status "Motorista 1 finaliza" 200 "$M1" finalizar
status "Acao invalida" 400 "$M1" voar

echo
if [ "$FALHAS" -eq 0 ]; then
  echo "Todos os cenarios passaram."
else
  echo "$FALHAS cenario(s) falharam."
  exit 1
fi