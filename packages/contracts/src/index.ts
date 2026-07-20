export const roles = ['ADMIN', 'MANAGER', 'SALES', 'CONSULTANT'] as const;
export type Role = (typeof roles)[number];

export const opportunityStageTypes = ['OPEN', 'WON', 'LOST'] as const;
export type OpportunityStageType = (typeof opportunityStageTypes)[number];

export interface ApiErrorResponse {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, string[]>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}
