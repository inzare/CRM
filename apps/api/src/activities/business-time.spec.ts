import { describe, expect, it } from 'vitest';

import { businessDayBounds } from './business-time';

describe('businessDayBounds', () => {
  it('uses the configured business timezone rather than the server timezone', () => {
    const bounds = businessDayBounds(new Date('2026-07-20T12:00:00.000Z'), 'America/Mexico_City');
    expect(bounds.start.toISOString()).toBe('2026-07-20T06:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-07-21T06:00:00.000Z');
  });

  it('handles daylight-saving day length', () => {
    const bounds = businessDayBounds(new Date('2026-03-08T16:00:00.000Z'), 'America/New_York');
    expect(bounds.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});
