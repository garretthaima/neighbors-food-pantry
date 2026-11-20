export type Role = 'viewer' | 'editor';

export interface Me {
    role: Role | null;
    viewNeedsPin: boolean;
}

export interface Product {
    id: number;
    barcode: string | null;
    name: string;
    brand: string;
    size: string;
    category: string;
    imageUrl: string;
    source: string;
    quantity: number;
    shelfId: number | null;
    shelfName: string | null;
    updatedAt: string;
}

export interface Shelf {
    id: number;
    name: string;
    notes: string;
    productCount: number;
    itemCount: number;
}

export interface StockEvent {
    id: string;
    delta: number;
    reason: 'in' | 'out' | 'adjust';
    createdAt: string;
    productId: number;
    productName: string;
}

export interface Activity {
    last30Days: { received: number; givenOut: number };
    events: StockEvent[];
}

export type ScanMode = 'in' | 'out';

export type ScanResult =
    { status: 'ok'; created: boolean; product: Product } | { status: 'unknown'; barcode: string };

export interface ProductInput {
    name: string;
    brand: string;
    size: string;
    category: string;
    barcode: string;
    shelfId: number | null;
    quantity: number;
}
