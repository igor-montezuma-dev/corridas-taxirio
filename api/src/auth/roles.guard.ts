import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator';
import { AuthenticatedRequest } from './authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get(Roles, context.getHandler());
     if (!roles) {
      throw new ForbiddenException('Rota sem perfis definidos');
    }
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return roles.includes(user.perfil);
  }
}
