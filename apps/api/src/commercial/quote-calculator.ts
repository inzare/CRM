import { BadRequestException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';

import type { QuoteLineDto } from './commercial.dto';

export function calculateQuote(lines: QuoteLineDto[]) {
  if (!lines.length)
    throw new BadRequestException({
      code: 'QUOTE_LINES_REQUIRED',
      message: 'A quote requires at least one line.',
    });
  let subtotal = new Prisma.Decimal(0);
  let discountTotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);
  const calculated = lines.map((line, index) => {
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const discountRate = new Prisma.Decimal(line.discountRate ?? 0);
    const taxRate = new Prisma.Decimal(line.taxRate ?? 0);
    if (
      quantity.lte(0) ||
      unitPrice.lt(0) ||
      discountRate.lt(0) ||
      discountRate.gt(100) ||
      taxRate.lt(0) ||
      taxRate.gt(100)
    )
      throw new BadRequestException({
        code: 'INVALID_QUOTE_AMOUNT',
        message: 'Quantities and rates must be within valid ranges.',
      });
    const lineSubtotal = quantity.mul(unitPrice).toDecimalPlaces(2);
    const discount = lineSubtotal.mul(discountRate).div(100).toDecimalPlaces(2);
    const taxable = lineSubtotal.sub(discount);
    const tax = taxable.mul(taxRate).div(100).toDecimalPlaces(2);
    const total = taxable.add(tax).toDecimalPlaces(2);
    subtotal = subtotal.add(lineSubtotal);
    discountTotal = discountTotal.add(discount);
    taxTotal = taxTotal.add(tax);
    return {
      catalogItemId: line.catalogItemId ?? null,
      sku: line.sku.trim(),
      description: line.description.trim(),
      quantity,
      unitPrice,
      discountRate,
      taxRate,
      subtotal: lineSubtotal,
      discount,
      tax,
      total,
      sortOrder: line.sortOrder ?? index,
    };
  });
  return {
    lines: calculated,
    subtotal: subtotal.toDecimalPlaces(2),
    discountTotal: discountTotal.toDecimalPlaces(2),
    taxTotal: taxTotal.toDecimalPlaces(2),
    total: subtotal.sub(discountTotal).add(taxTotal).toDecimalPlaces(2),
  };
}
