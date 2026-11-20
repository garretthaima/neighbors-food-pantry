import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from '../barcode.ts';

describe('normalizeBarcode', () => {
    it('pads UPC-A to 13 digits and keeps EAN-13 as is', () => {
        expect(normalizeBarcode('024000163022')).toBe('0024000163022');
        expect(normalizeBarcode('3017620422003')).toBe('3017620422003');
        expect(normalizeBarcode(' 0240-0016 3022 ')).toBe('0024000163022');
    });

    it('rejects things that are not retail barcodes', () => {
        for (const bad of ['', 'abc', '12345', 'https://example.com', null, undefined, {}]) {
            expect(normalizeBarcode(bad)).toBeNull();
        }
    });
});
