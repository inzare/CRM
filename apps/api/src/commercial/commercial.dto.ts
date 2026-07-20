import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PageQueryDto } from '../common/pagination';
import { CatalogType, ContractStatus, PricingModel, QuoteStatus } from '../generated/prisma/client';

export class CommercialListQueryDto extends PageQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) active?: boolean;
  @IsOptional() @IsUUID() opportunityId?: string;
}
export class CatalogItemDto {
  @IsString() @MaxLength(80) sku!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(120) category!: string;
  @IsEnum(CatalogType) type!: CatalogType;
  @IsEnum(PricingModel) pricingModel!: PricingModel;
  @IsNumberString() price!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
}
export class OpportunityItemDto {
  @IsUUID() catalogItemId!: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsNumberString() unitPrice?: string;
  @IsOptional() @IsString() @MaxLength(500) billingNotes?: string;
}
export class QuoteLineDto {
  @IsOptional() @IsUUID() catalogItemId?: string;
  @IsString() @MaxLength(80) sku!: string;
  @IsString() @MaxLength(10000) description!: string;
  @IsNumberString() quantity!: string;
  @IsNumberString() unitPrice!: string;
  @IsOptional() @IsNumberString() discountRate?: string;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class CreateQuoteDto {
  @IsUUID() opportunityId!: string;
  @IsDateString() validUntil!: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuoteLineDto) lines!: QuoteLineDto[];
}
export class TransitionQuoteDto {
  @IsEnum(QuoteStatus) status!: QuoteStatus;
}
export class CreateContractDto {
  @IsUUID() opportunityId!: string;
  @IsUUID() quoteId!: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsString() @MaxLength(80) number!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() renewalDate?: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus;
  @IsOptional() @IsString() @MaxLength(10000) renewalNotes?: string;
}
export class RenewalQueryDto extends PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 90;
}
