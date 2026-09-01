import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clerkMiddleware } from '@clerk/express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('app.port');
  const frontendUrl = configService.getOrThrow<string>('app.frontendUrl');
  const clerkSecretKey = configService.getOrThrow<string>('clerk.secretKey');
  const clerkPublishableKey = configService.getOrThrow<string>(
    'clerk.publishableKey',
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    clerkMiddleware({
      secretKey: clerkSecretKey,
      publishableKey: clerkPublishableKey,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
}

void bootstrap();
