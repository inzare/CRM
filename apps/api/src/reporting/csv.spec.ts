import { describe, expect, it } from 'vitest';

import { csvCell, csvDocument } from './csv';
describe('CSV safety', () => {
  it('neutralizes spreadsheet formulas and quotes values', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
    expect(csvCell('A "quote"')).toBe('"A ""quote"""');
  });
  it('includes a UTF-8 BOM and CRLF records', () => {
    expect(csvDocument(['Name'], [['Acme']])).toBe('\uFEFF"Name"\r\n"Acme"\r\n');
  });
});
