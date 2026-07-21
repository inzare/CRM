import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser, RequestMetadata } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { requestIdOf } from '../common/request-id.middleware';
import { Role } from '../generated/prisma/client';

import {
  ActivityDto,
  TaskDto,
  TaskListQueryDto,
  UpdateActivityDto,
  UpdateTaskDto,
} from './activities.dto';
import { ActivitiesService } from './activities.service';
@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller()
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}
  @Get('activities') activitiesList(
    @Query() query: TaskListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.activities.listActivities(query, actor);
  }
  @Post('activities') createActivity(
    @Body() input: ActivityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.createActivity(input, actor, metadata(request));
  }
  @Patch('activities/:id') updateActivity(
    @Param('id') id: string,
    @Body() input: UpdateActivityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.updateActivity(id, input, actor, metadata(request));
  }
  @Delete('activities/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteActivity(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.deleteActivity(id, actor, metadata(request));
  }
  @Get('tasks') tasks(@Query() query: TaskListQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.activities.tasks(query, actor);
  }
  @Post('tasks') createTask(
    @Body() input: TaskDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.createTask(input, actor, metadata(request));
  }
  @Patch('tasks/:id') updateTask(
    @Param('id') id: string,
    @Body() input: UpdateTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.updateTask(id, input, actor, metadata(request));
  }
  @Delete('tasks/:id') @Roles(Role.ADMIN, Role.MANAGER) @HttpCode(HttpStatus.NO_CONTENT) deleteTask(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.deleteTask(id, actor, metadata(request));
  }
  @Post('tasks/:id/complete') complete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.complete(id, actor, false, metadata(request));
  }
  @Post('tasks/:id/reopen') reopen(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.activities.complete(id, actor, true, metadata(request));
  }
  @Get('follow-up/widgets') widgets(@CurrentUser() actor: AuthenticatedUser) {
    return this.activities.widgets(actor);
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
