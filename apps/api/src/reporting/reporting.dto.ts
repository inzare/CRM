import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
