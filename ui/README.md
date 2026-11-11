# UI

Interface mínima em React para demonstrar o fluxo das corridas: o passageiro pede, o motorista aceita, inicia e finaliza, e as duas telas acompanham as mudanças.

## Como rodar

Junto com o resto do sistema, pelo compose na raiz do repositório:

```bash
docker compose up -d --build ui
```

A UI fica em http://localhost:8080. Para entrar, cole um token gerado com:

```bash
node scripts/generate-token.mjs
```

Em desenvolvimento, com a API rodando em `localhost:3000`:

```bash
cd ui
npm install
npm run dev
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento do Vite, com proxy de `/api` para a API |
| `npm run build` | Verifica os tipos (`tsc --noEmit`) e gera os arquivos estáticos |
| `npm run lint` | Oxlint, falhando com qualquer aviso |
| `npm test` | Testes das funções puras com Vitest |

## Stack

- React 19 + TypeScript, com Vite
- TanStack Query para a lista e as ações
- Sonner para os toasts
- Tailwind CSS 4 para toda a estilização, com as cores do tema em `src/styles.css`
- nginx servindo os arquivos estáticos no container

## Estrutura

```
src/
├── api/              HTTP puro, sem React: request, ApiError e as chamadas de auth e corridas
├── components/ui/    Botao, Cartao, AvisoErro e o estilo dos campos
├── lib/              configuração do TanStack Query e formatação de erros
├── features/
│   ├── auth/         validação do token e tela de login
│   └── corridas/     hooks de dados, regras, constantes e componentes da lista e do formulário
├── App.tsx           sessão e cabeçalho
└── main.tsx          providers e Toaster
```

As dependências vão em um sentido só: componentes usam hooks, hooks usam a camada `api/`, e a camada `api/` não conhece React. Os toasts ficam nos componentes, e não nos hooks, para que cada tela decida como avisar o usuário.

## Decisões

**Proxy no nginx, sem CORS.** O navegador acessa a UI em `:8080` e a API em `:8080/api`. O nginx repassa `/api/*` para a API removendo o prefixo (`proxy_pass http://api:3000/`). Para o navegador, as duas ficam na mesma origem, e a API não precisa de configuração de CORS. Em desenvolvimento, o Vite faz o mesmo repasse.

**Token só em memória.** O token fica no state do React e some ao recarregar a página. No `localStorage`, ele poderia ser lido por qualquer script injetado na página.

**Chave do cache inclui o token.** A lista usa a chave `['corridas', token]`. Ao trocar de usuário, a lista começa do zero, sem mostrar por um instante as corridas do usuário anterior. A mesma função (`corridasKey`) é usada para invalidar a lista depois de cada ação.

**Polling com o TanStack Query.** A lista é recarregada a cada 3 s com `refetchInterval`. Uma busca nova só começa quando a anterior termina, e o polling pausa com a aba em segundo plano. Notificação em tempo real (WebSocket ou SSE) está nos limites do projeto.

**Política de retry.** As queries repetem no máximo duas vezes, e só em falha de rede ou erro 5xx: um 401 ou 403 não melhora tentando de novo. As mutations nunca repetem sozinhas: um PATCH repetido sem o usuário pedir viraria 409, e o POST depende da `Idempotency-Key`.

**Ciclo da `Idempotency-Key`.** A chave é gerada com `crypto.randomUUID()` quando o formulário abre e só muda depois de uma criação confirmada (201 ou 200). Se a requisição falhar, a chave continua a mesma, e o próximo envio é tratado pela API como repetição do mesmo pedido. O botão "Reenviar o último pedido" existe para demonstrar isso: a segunda resposta é 200, e nenhuma corrida nova é criada.

**A UI não decide regras.** A função `acaoDisponivel` só escolhe qual botão mostrar. Quem decide se a ação vale é a API: um clique atrasado ou de outro motorista recebe 409 ou 403, a mensagem aparece num toast e a lista é recarregada com o estado real.

**Erros com status.** Os erros aparecem como `status · mensagem`. A leitura entende o formato padrão do Nest (`{ message }`), o do `ZodValidationPipe` (`{ message, erros }`) e respostas que não são JSON, como a página de erro do nginx num 502.

## Limites

- Só as funções puras têm teste (`acaoDisponivel` e `mensagemDeErro`). Os componentes não têm: isso exigiria Testing Library e um DOM simulado.
- Não há login de verdade: a API não emite tokens, então a UI recebe um token já gerado.
