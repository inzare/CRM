import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PageQueryDto } from '../common/pagination';
import { ActivityType, TaskPriority, TaskStatus } from '../generated/prisma/client';

export class ActivityDto {
  @IsEnum(ActivityType) type!: ActivityType;
  @IsString() @MaxLength(240) subject!: string;
  @IsOptional() @IsString() @MaxLength(10000) body?: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() opportunityId?: string;
}
export class TaskDto {
  @IsString() @MaxLength(240) subject!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsDateString() dueAt!: string;
  @IsUUID() assigneeId!: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() opportunityId?: string;
}
export class TaskListQueryDto extends PageQueryDto {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsString() view?: 'today' | 'overdue';
}
