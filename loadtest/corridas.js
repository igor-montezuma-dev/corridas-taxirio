import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://api:3000';
const PASSENGER_TOKEN = __ENV.TOKEN_P1;
const DRIVER_TOKEN = __ENV.TOKEN_M1;

export const options = {
  scenarios: {
    fluxo_completo: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:POST /corridas}': ['p(95)<500'],
    'http_req_duration{name:GET /corridas/:id}': ['p(95)<200'],
    'http_req_duration{name:PATCH /corridas/:id/status}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  if (!PASSENGER_TOKEN || !DRIVER_TOKEN) {
    throw new Error('Defina TOKEN_P1 e TOKEN_M1 antes de rodar');
  }
}

function headers(token, extras = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Request-Id': `k6-${__VU}-${__ITER}`,
    ...extras,
  };
}

export default function () {
  let corridaId;

  group('passageiro cria e consulta', () => {
    const criada = http.post(
      `${BASE_URL}/corridas`,
      JSON.stringify({ origem: 'Centro', destino: 'Barra' }),
      {
        headers: headers(PASSENGER_TOKEN, {
          'Idempotency-Key': `k6-${__VU}-${__ITER}-${Date.now()}`,
        }),
        tags: { name: 'POST /corridas' },
      },
    );
    check(criada, { 'POST 201': (r) => r.status === 201 });
    corridaId = criada.json('id');

    const consulta = http.get(`${BASE_URL}/corridas/${corridaId}`, {
      headers: headers(PASSENGER_TOKEN),
      tags: { name: 'GET /corridas/:id' },
    });
    check(consulta, { 'GET 200': (r) => r.status === 200 });
  });

  if (!corridaId) return;

  group('motorista conduz a corrida', () => {
    for (const acao of ['aceitar', 'iniciar', 'finalizar']) {
      const res = http.patch(
        `${BASE_URL}/corridas/${corridaId}/status`,
        JSON.stringify({ acao }),
        {
          headers: headers(DRIVER_TOKEN),
          tags: { name: 'PATCH /corridas/:id/status' },
        },
      );
      check(res, { [`PATCH ${acao} 200`]: (r) => r.status === 200 });
    }
  });

  sleep(1);
}
