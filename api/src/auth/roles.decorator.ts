
import { Reflector } from '@nestjs/core';
import { Perfil } from './authenticated-user';

export const Roles = Reflector.createDecorator<Perfil[]>();
