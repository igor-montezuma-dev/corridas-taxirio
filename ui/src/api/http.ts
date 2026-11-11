export interface Resposta<T> {
  status: number;
  body: T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function mensagemDeErro(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const { message, erros } = body as {
      message?: string | string[];
      erros?: { campo: string; mensagem: string }[];
    };
    if (erros?.length) {
      return erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ");
    }
    if (Array.isArray(message)) return message.join("; ");
    if (message) return message;
  }
  return `Erro ${status}: a API não respondeu com JSON`;
}

export async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Resposta<T>> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new ApiError(response.status, mensagemDeErro(body, response.status));
  }
  return { status: response.status, body: body as T };
}
