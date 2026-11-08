import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { Corrida } from './corrida';
import { CorridasService } from './corridas.service';
import { createCorridaSchema } from './dto/create-corrida.schema';
import type { CreateCorrida } from './dto/create-corrida.schema';

@Controller('corridas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CorridasController {
  constructor(private readonly corridasService: CorridasService) {}

  @Post()
  @Roles(['passageiro'])
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') chave: string | undefined,
    @Body(new ZodValidationPipe(createCorridaSchema)) body: CreateCorrida,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Corrida> {
    if (!chave || chave.length > 100) {
      throw new BadRequestException(
        'Cabeçalho Idempotency-Key obrigatório, com até 100 caracteres',
      );
    }

    const { corrida, criada } = await this.corridasService.create(
      user,
      chave,
      body,
    );
    res.status(criada ? 201 : 200);
    return corrida;
  }

  @Get(':id')
  @Roles(['passageiro', 'motorista'])
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Corrida> {
    return this.corridasService.findOne(user, id);
  }
}
