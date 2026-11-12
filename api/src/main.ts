import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { CORRELATION_HEADER, correlation } from './common/correlation';
import { httpDuration, httpRequests } from './metrics/metrics';

const VALID_ID = /^[\w-]{1,100}$/;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.disable('x-powered-by');

  app.use((req: Request, res: Response, next: NextFunction) => {
    const recebido = req.headers[CORRELATION_HEADER];
    const id =
      typeof recebido === 'string' && VALID_ID.test(recebido)
        ? recebido
        : randomUUID();
    req.headers[CORRELATION_HEADER] = id;
    res.setHeader('X-Request-Id', id);
    correlation.run(id, next);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics' || req.path === '/health') {
      next();
      return;
    }

    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const rota = req.route as { path?: string } | undefined;
      const route = rota?.path
        ? `${req.baseUrl}${rota.path}`
        : 'nao_encontrada';
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      const segundos = Number(process.hrtime.bigint() - start) / 1e9;

      httpRequests.inc(labels);
      httpDuration.observe(labels, segundos);
    });

    next();
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
