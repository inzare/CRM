import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AssigneesController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, AssigneesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
