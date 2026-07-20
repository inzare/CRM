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
import { requestIdOf } from '../common/request-id.middleware';

import {
  CreateCompanyDto,
  CreateContactDto,
  CustomerListQueryDto,
  TimelineQueryDto,
  UpdateCompanyDto,
  UpdateContactDto,
} from './customers.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get('companies') listCompanies(
    @Query() query: CustomerListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customers.listCompanies(query, actor);
  }
  @Get('companies/:id') company(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.customers.company(id, actor);
  }
  @Post('companies') createCompany(
    @Body() input: CreateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.createCompany(input, actor, metadata(request));
  }
  @Patch('companies/:id') updateCompany(
    @Param('id') id: string,
    @Body() input: UpdateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.updateCompany(id, input, actor, metadata(request));
  }
  @Delete('companies/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteCompany(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.deleteCompany(id, actor, metadata(request));
  }
  @Get('companies/:id/timeline') companyTimeline(
    @Param('id') id: string,
    @Query() query: TimelineQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customers.timeline('company', id, query, actor);
  }
  @Get('contacts') listContacts(
    @Query() query: CustomerListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customers.listContacts(query, actor);
  }
  @Get('companies/:companyId/contacts') companyContacts(
    @Param('companyId') companyId: string,
    @Query() query: CustomerListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customers.listContacts(query, actor, companyId);
  }
  @Post('contacts') createContact(
    @Body() input: CreateContactDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.createContact(input, actor, metadata(request));
  }
  @Patch('contacts/:id') updateContact(
    @Param('id') id: string,
    @Body() input: UpdateContactDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.updateContact(id, input, actor, metadata(request));
  }
  @Delete('contacts/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteContact(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.customers.deleteContact(id, actor, metadata(request));
  }
  @Get('contacts/:id/timeline') contactTimeline(
    @Param('id') id: string,
    @Query() query: TimelineQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customers.timeline('contact', id, query, actor);
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
