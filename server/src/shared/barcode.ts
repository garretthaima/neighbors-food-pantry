/**
 * Turns whatever a scanner or a person typed into the form we store.
 *
 * Retail barcodes are 8 (EAN-8 / UPC-E), 12 (UPC-A), 13 (EAN-13) or 14
 * (GTIN-14) digits. A 12-digit UPC-A is the same number as the 13-digit EAN
 * with a leading zero, and scanners differ on which one they send, so UPC-A
 * is padded to 13 to keep one row per product.
 *
 * Returns null when the input is not a retail barcode.
 */
export function normalizeBarcode(input: unknown): string | null {
    if (typeof input !== 'string' && typeof input !== 'number') return null;
    const digits = String(input).replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digits)) return null;
    if (digits.length === 12) return `0${digits}`;
    if (digits.length === 8 || digits.length === 13 || digits.length === 14) return digits;
    return null;
}

/** The 12-digit UPC-A form of a stored barcode, when it has one. */
export function toUpcA(barcode: string): string | null {
    return barcode.length === 13 && barcode.startsWith('0') ? barcode.slice(1) : null;
}
