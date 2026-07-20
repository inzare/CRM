import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
@Module({
  imports: [AuditModule, AuthModule],
  controllers: [CommercialController],
  providers: [CommercialService],
})
export class CommercialModule {}
