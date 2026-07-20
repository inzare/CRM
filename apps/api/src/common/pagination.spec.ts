import { describe, expect, it } from 'vitest';

import { pageMeta } from './pagination';

describe('pageMeta', () => {
  it('calculates stable page metadata', () => {
    expect(pageMeta(2, 25, 61)).toEqual({ page: 2, pageSize: 25, total: 61, totalPages: 3 });
  });

  it('returns zero pages for an empty collection', () => {
    expect(pageMeta(1, 25, 0).totalPages).toBe(0);
  });
});
