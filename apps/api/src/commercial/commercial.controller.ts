import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  CatalogItemDto,
  CommercialListQueryDto,
  CreateContractDto,
  CreateQuoteDto,
  OpportunityItemDto,
  RenewalQueryDto,
  TransitionQuoteDto,
} from './commercial.dto';
import { CommercialService } from './commercial.service';
@ApiTags('commercial')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.SALES)
@Controller()
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}
  @Get('catalog') catalog(@Query() query: CommercialListQueryDto) {
    return this.commercial.catalog(query);
  }
  @Post('catalog') @Roles(Role.ADMIN, Role.MANAGER) createCatalog(
    @Body() input: CatalogItemDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.commercial.createCatalog(input, actor, metadata(request));
  }
  @Patch('catalog/:id') @Roles(Role.ADMIN, Role.MANAGER) updateCatalog(
    @Param('id') id: string,
    @Body() input: CatalogItemDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.commercial.updateCatalog(id, input, actor, metadata(request));
  }
  @Post('opportunities/:id/items') addOffering(
    @Param('id') id: string,
    @Body() input: OpportunityItemDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commercial.addOffering(id, input, actor);
  }
  @Get('quotes') quotes(
    @Query() query: CommercialListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commercial.quotes(query, actor);
  }
  @Post('quotes') createQuote(
    @Body() input: CreateQuoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.commercial.createQuote(input, actor, metadata(request));
  }
  @Get('quotes/:id') quote(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.commercial.quote(id, actor);
  }
  @Post('quotes/:id/status') transition(
    @Param('id') id: string,
    @Body() input: TransitionQuoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.commercial.transitionQuote(id, input.status, actor, metadata(request));
  }
  @Post('contracts') createContract(
    @Body() input: CreateContractDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.commercial.createContract(input, actor, metadata(request));
  }
  @Get('contracts') contracts(
    @Query() query: CommercialListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commercial.contracts(query, actor);
  }
  @Get('contracts/renewals/upcoming') renewals(
    @Query() query: RenewalQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.commercial.renewals(query, actor);
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
