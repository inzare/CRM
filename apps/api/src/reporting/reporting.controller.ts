import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/client';

import { ReportQueryDto } from './reporting.dto';
import { ReportingService } from './reporting.service';
@ApiTags('reporting')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}
  @Get('dashboard') dashboard(
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reporting.dashboard(query, actor);
  }
  @Get('reports/:kind.csv')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.SALES)
  async export(
    @Param('kind') kind: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() response: Response,
  ) {
    if (!['opportunities', 'offering-sales', 'renewals', 'overdue'].includes(kind)) {
      response.status(404).json({ code: 'RESOURCE_NOT_FOUND', message: 'Report not found.' });
      return;
    }
    const csv = await this.reporting.export(
      kind as 'opportunities' | 'offering-sales' | 'renewals' | 'overdue',
      query,
      actor,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="consultflow-${kind}.csv"`);
    response.send(csv);
  }
}
