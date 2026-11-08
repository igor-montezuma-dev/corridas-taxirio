import type { Request } from 'express';
export type Perfil = 'passageiro' | 'motorista';

export interface AuthenticatedUser {
    sub: string;
    perfil: Perfil;
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
