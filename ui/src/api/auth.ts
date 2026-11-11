import { request } from './http';
import type { Usuario } from './types';

export const authApi = {
  me: (token: string) => request<Usuario>(token, '/auth/me'),
};