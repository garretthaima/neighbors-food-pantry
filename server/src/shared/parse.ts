// Request input parsers. Each returns a clean value or throws a 400 the
// person can read. Routes call these; services receive the parsed result.
import type { Request } from 'express';
import { normalizeBarcode } from './barcode.ts';
import { badRequest, notFound } from './errors.ts';

export function idParam(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    return id;
}

export function optionalText(value: unknown, field: string, max = 200): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw badRequest(`${field} must be text.`);
    const trimmed = value.trim();
    if (trimmed.length > max) throw badRequest(`${field} is too long.`);
    return trimmed;
}

export function requiredText(value: unknown, field: string, max = 200): string {
    const result = optionalText(value, field, max);
    if (!result) throw badRequest(`${field} is required.`);
    return result;
}

/** undefined = not sent, null = clear the shelf, number = that shelf. */
export function optionalShelfId(value: unknown): number | null | undefined {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        throw badRequest('Shelf is not valid.');
    }
    return value;
}

/** undefined = not sent, null = no barcode, string = normalized barcode. */
export function optionalBarcode(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const barcode = normalizeBarcode(value);
    if (!barcode) throw badRequest('Barcodes are 8, 12, 13 or 14 digits.');
    return barcode;
}

export function wholeNumber(value: unknown, field: string, min: number): number {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < min ||
        Math.abs(value) > 100_000
    ) {
        throw badRequest(`${field} must be a whole number.`);
    }
    return value;
}
