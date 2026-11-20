import { badRequest } from '../../shared/errors.ts';
import {
    optionalBarcode,
    optionalShelfId,
    optionalText,
    requiredText,
    wholeNumber,
} from '../../shared/parse.ts';
import type { NewProduct, ProductChanges, StockReason } from './service.ts';

type Body = Record<string, unknown>;

export function parseNewProduct(body: Body): NewProduct {
    return {
        name: requiredText(body.name, 'Name'),
        brand: optionalText(body.brand, 'Brand') ?? '',
        size: optionalText(body.size, 'Size') ?? '',
        category: optionalText(body.category, 'Category') ?? '',
        barcode: optionalBarcode(body.barcode) ?? null,
        shelfId: optionalShelfId(body.shelfId) ?? null,
        quantity: body.quantity === undefined ? 0 : wholeNumber(body.quantity, 'Quantity', 0),
    };
}

export function parseProductChanges(body: Body): ProductChanges {
    return {
        columns: {
            name: body.name === undefined ? undefined : requiredText(body.name, 'Name'),
            brand: optionalText(body.brand, 'Brand'),
            size: optionalText(body.size, 'Size'),
            category: optionalText(body.category, 'Category'),
            barcode: optionalBarcode(body.barcode),
            shelf_id: optionalShelfId(body.shelfId),
        },
        quantity:
            body.quantity === undefined ? undefined : wholeNumber(body.quantity, 'Quantity', 0),
    };
}

export function parseStockChange(body: Body): { delta: number; reason: StockReason } {
    const delta = wholeNumber(body.delta, 'Change', -100_000);
    if (delta === 0) throw badRequest('Change cannot be zero.');
    const reason = body.reason === 'adjust' ? 'adjust' : delta > 0 ? 'in' : 'out';
    return { delta, reason };
}
