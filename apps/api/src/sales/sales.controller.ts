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
  ConvertLeadDto,
  CreateLeadDto,
  CreateOpportunityDto,
  QualifyLeadDto,
  SalesListQueryDto,
  TransitionOpportunityDto,
  UpdateLeadDto,
  UpdateOpportunityDto,
  UpdateStageDto,
} from './sales.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.SALES)
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}
  @Get('pipeline-stages') stages() {
    return this.sales.stages();
  }
  @Patch('pipeline-stages/:id') @Roles(Role.ADMIN, Role.MANAGER) updateStage(
    @Param('id') id: string,
    @Body() input: UpdateStageDto,
  ) {
    return this.sales.updateStage(id, input);
  }
  @Get('leads') leads(@Query() query: SalesListQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.sales.leads(query, actor);
  }
  @Post('leads') createLead(
    @Body() input: CreateLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.createLead(input, actor, metadata(request));
  }
  @Get('leads/:id') lead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.sales.lead(id, actor);
  }
  @Patch('leads/:id') updateLead(
    @Param('id') id: string,
    @Body() input: UpdateLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.updateLead(id, input, actor, metadata(request));
  }
  @Delete('leads/:id') @Roles(Role.ADMIN, Role.MANAGER) @HttpCode(HttpStatus.NO_CONTENT) deleteLead(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.deleteLead(id, actor, metadata(request));
  }
  @Post('leads/:id/qualify') qualify(
    @Param('id') id: string,
    @Body() input: QualifyLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.qualifyLead(id, input, actor, metadata(request));
  }
  @Post('leads/:id/convert') convert(
    @Param('id') id: string,
    @Body() input: ConvertLeadDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.convertLead(id, input, actor, metadata(request));
  }
  @Get('opportunities') opportunities(
    @Query() query: SalesListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sales.opportunities(query, actor);
  }
  @Post('opportunities') createOpportunity(
    @Body() input: CreateOpportunityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.createOpportunity(input, actor, metadata(request));
  }
  @Get('opportunities/:id') opportunity(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sales.opportunity(id, actor);
  }
  @Patch('opportunities/:id') updateOpportunity(
    @Param('id') id: string,
    @Body() input: UpdateOpportunityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.updateOpportunity(id, input, actor, metadata(request));
  }
  @Delete('opportunities/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOpportunity(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.deleteOpportunity(id, actor, metadata(request));
  }
  @Post('opportunities/:id/transition') transition(
    @Param('id') id: string,
    @Body() input: TransitionOpportunityDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.sales.transition(id, input, actor, metadata(request));
  }
  @Get('pipeline') board(
    @Query() query: SalesListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sales.board(query, actor);
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
