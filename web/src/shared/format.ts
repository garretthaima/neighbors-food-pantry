import type { Product } from './types';

/** "1 item", "2 items" */
export function count(n: number, noun: string): string {
    return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
}

/** "Del Monte, 14.5 oz" */
export function describe(product: Pick<Product, 'brand' | 'size' | 'category'>): string {
    return [product.brand, product.size].filter(Boolean).join(', ') || product.category;
}
