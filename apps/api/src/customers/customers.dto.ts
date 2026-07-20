import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { PageQueryDto } from '../common/pagination';

export class CustomerListQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsString() @MaxLength(80) tag?: string;
}

export class CreateCompanyDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) website?: string;
  @IsOptional() @IsString() @MaxLength(60) size?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateCompanyDto extends CreateCompanyDto {
  @IsISO8601() expectedUpdatedAt!: string;
}

export class CreateContactDto {
  @IsUUID() companyId!: string;
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(160) jobTitle?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isDecisionMaker?: boolean;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;
}

export class UpdateContactDto extends CreateContactDto {
  @IsISO8601() expectedUpdatedAt!: string;
}

export class TimelineQueryDto extends PageQueryDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsUUID() actorId?: string;
}
