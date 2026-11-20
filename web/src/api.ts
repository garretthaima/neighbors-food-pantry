import type { Activity, Me, Product, ProductInput, Role, ScanMode, ScanResult, Shelf } from './types';

/** An error whose message was written for the person using the app. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the pantry server. Check the internet connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Try again.');
  }
  return data as T;
}

export const api = {
  me: () => call<Me>('GET', '/me'),
  login: (pin: string) => call<{ role: Role }>('POST', '/login', { pin }),
  logout: () => call<{ role: Role | null }>('POST', '/logout'),

  products: () => call<Product[]>('GET', '/products'),
  createProduct: (input: ProductInput) => call<Product>('POST', '/products', input),
  updateProduct: (id: number, input: Partial<ProductInput>) => call<Product>('PATCH', `/products/${id}`, input),
  deleteProduct: (id: number) => call<void>('DELETE', `/products/${id}`),
  changeStock: (id: number, delta: number, reason?: 'adjust') =>
    call<Product>('POST', `/products/${id}/stock`, { delta, reason }),

  scan: (barcode: string, mode: ScanMode, shelfId: number | null) =>
    call<ScanResult>('POST', '/scan', { barcode, mode, shelfId: shelfId ?? undefined }),

  shelves: () => call<Shelf[]>('GET', '/shelves'),
  createShelf: (name: string) => call<Shelf>('POST', '/shelves', { name }),
  renameShelf: (id: number, name: string) => call<Shelf>('PATCH', `/shelves/${id}`, { name }),
  deleteShelf: (id: number) => call<void>('DELETE', `/shelves/${id}`),

  activity: () => call<Activity>('GET', '/activity'),
};

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.';
}
