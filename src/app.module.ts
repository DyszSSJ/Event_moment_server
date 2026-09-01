import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from './config/app.config';
import clerkConfig from './config/clerk.config';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, clerkConfig, databaseConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule {}
