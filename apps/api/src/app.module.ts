import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { ActivitiesModule } from './activities/activities.module';
import { AuditApiModule } from './audit/audit-api.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommercialModule } from './commercial/commercial.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ApplicationThrottlerGuard } from './common/application-throttler.guard';
import { requestIdMiddleware } from './common/request-id.middleware';
import { validateEnvironment } from './config/environment';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { SalesModule } from './sales/sales.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    AuditApiModule,
    UsersModule,
    CustomersModule,
    SalesModule,
    CommercialModule,
    ActivitiesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: ApplicationThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
