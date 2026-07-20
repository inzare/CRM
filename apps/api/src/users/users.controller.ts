import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { requestIdOf } from '../common/request-id.middleware';
import { Role } from '../generated/prisma/client';

import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter users' })
  list(@Query() query: UserListQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create or invite a user' })
  create(
    @Body() input: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.create(input, actor.id, metadata(request));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update, activate, deactivate, or change role for a user' })
  update(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.users.update(id, input, actor.id, metadata(request));
  }
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('assignees')
export class AssigneesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List active safe user summaries for assignment controls' })
  list() {
    return this.users.assignees();
  }
}

function metadata(request: Request): RequestMetadata {
  const userAgent = request.header('user-agent');
  return {
    requestId: requestIdOf(request),
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}
