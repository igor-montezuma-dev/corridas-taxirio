# Limites

## Riscos conhecidos
- Há vulnerabilidades reportadas pelo `npm audit` em dependências de desenvolvimento (Jest, ESLint, Nest CLI). `npm audit --omit=dev` mostra 0 em produção. Com mais tempo, eu atualizaria essas ferramentas e adicionaria o `npm audit --omit=dev` ao CI.