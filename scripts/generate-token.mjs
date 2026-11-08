// Gera tokens JWT de TESTE assinados com a chave privada de teste (RS256).
// Uso: node scripts/generate-token.mjs
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const privateKey = readFileSync('keys/test-fixtures/jwt-private.test-only.pem', 'utf8');

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function gerarToken(sub, perfil) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const agora = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    perfil,
    iss: 'corridas-test-issuer',
    aud: 'corridas-api',
    iat: agora,
    exp: agora + 60 * 60 * 24 * 365, // 1 ano: tokens estáticos de teste
  };

  const conteudo = `${base64url(header)}.${base64url(payload)}`;
  const assinatura = createSign('RSA-SHA256').update(conteudo).sign(privateKey, 'base64url');
  return `${conteudo}.${assinatura}`;
}

const usuarios = [
  ['passageiro-1', 'passageiro'],
  ['passageiro-2', 'passageiro'],
  ['motorista-1', 'motorista'],
  ['motorista-2', 'motorista'],
];

for (const [sub, perfil] of usuarios) {
  console.log(`\n# ${sub} (${perfil})\n${gerarToken(sub, perfil)}`);
}