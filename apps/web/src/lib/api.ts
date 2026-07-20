import type { ApiErrorResponse } from '@consultflow/contracts';

const configuredApiBase: unknown = import.meta.env.VITE_API_URL;
const apiBase = typeof configuredApiBase === 'string' ? configuredApiBase : '/api/v1';
let accessToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(body.message);
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerRefreshHandler(handler: () => Promise<boolean>): () => void {
  refreshHandler = handler;
  return () => {
    if (refreshHandler === handler) refreshHandler = null;
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && refreshHandler && (await refreshHandler())) {
    return apiRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      code: 'REQUEST_FAILED',
      message: 'The request could not be completed.',
      requestId: response.headers.get('x-request-id') ?? 'unknown',
    }))) as ApiErrorResponse;
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadApiFile(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBase}${path}`, { headers, credentials: 'include' });
  if (!response.ok) throw new Error('The export could not be downloaded.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
