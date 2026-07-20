import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PageQueryDto } from '../common/pagination';
import { LeadStatus } from '../generated/prisma/client';

export class SalesListQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() stageId?: string;
  @IsOptional() @IsIn(Object.values(LeadStatus)) status?: LeadStatus;
}

export class CreateLeadDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsString() @MaxLength(100) contactFirstName!: string;
  @IsString() @MaxLength(100) contactLastName!: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsString() @MaxLength(120) source!: string;
  @IsString() @MaxLength(10000) interest!: string;
  @IsOptional() @IsNumberString() budget?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() @MaxLength(120) expectedTimeline?: string;
  @IsOptional() @IsString() @MaxLength(10000) qualificationNotes?: string;
  @IsOptional() @IsUUID() ownerId?: string;
}
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class QualifyLeadDto {
  @IsString() @MaxLength(10000) qualificationNotes!: string;
}

export class ConvertLeadDto {
  @IsString() @MaxLength(200) opportunityName!: string;
  @IsNumberString() expectedValue!: string;
  @IsDateString() closeDate!: string;
}

export class CreateOpportunityDto {
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() companyId!: string;
  @IsOptional() @IsUUID() primaryContactId?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsUUID() stageId!: string;
  @IsNumberString() expectedValue!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsInt() @Min(0) @Max(100) probability!: number;
  @IsDateString() closeDate!: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}
export class UpdateOpportunityDto extends PartialType(
  OmitType(CreateOpportunityDto, ['stageId'] as const),
) {}

export class TransitionOpportunityDto {
  @IsUUID() expectedStageId!: string;
  @IsUUID() toStageId!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MaxLength(200) competitor?: string;
  @IsOptional() @IsString() @MaxLength(500) lossReason?: string;
}

export class UpdateStageDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) order?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) defaultProbability?: number;
  @IsOptional() isActive?: boolean;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) allowedToStageIds?: string[];
}
