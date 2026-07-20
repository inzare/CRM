import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { PageQueryDto } from '../common/pagination';
import { Role } from '../generated/prisma/client';

export class UserListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class CreateUserDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  @Length(12, 128)
  password?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
