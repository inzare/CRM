import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @Length(32, 256)
  token!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

export class AcceptInvitationDto {
  @IsString()
  @Length(32, 256)
  token!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

export class UpdateProfileDto {
  @IsString()
  @Length(2, 160)
  name!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
