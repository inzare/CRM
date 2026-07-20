import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
@Module({
  imports: [AuditModule, AuthModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
