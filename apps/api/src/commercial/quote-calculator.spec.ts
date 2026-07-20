import { describe, expect, it } from 'vitest';

import { calculateQuote } from './quote-calculator';

describe('calculateQuote', () => {
  it('rounds each authoritative line and totals discounts and tax', () => {
    const result = calculateQuote([
      {
        sku: 'CONSULT',
        description: 'Consulting',
        quantity: '2.5',
        unitPrice: '100.005',
        discountRate: '10',
        taxRate: '16',
      },
    ]);
    expect(result.subtotal.toString()).toBe('250.01');
    expect(result.discountTotal.toString()).toBe('25');
    expect(result.taxTotal.toString()).toBe('36');
    expect(result.total.toString()).toBe('261.01');
  });
  it('rejects invalid rates', () => {
    expect(() =>
      calculateQuote([
        { sku: 'X', description: 'X', quantity: '1', unitPrice: '1', discountRate: '101' },
      ]),
    ).toThrow();
  });
});
