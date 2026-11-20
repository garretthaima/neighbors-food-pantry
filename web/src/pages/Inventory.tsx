import { LayoutList, Minus, PackageOpen, Plus, ScanBarcode, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, messageOf } from '../api';
import { ProductForm } from '../components/ProductForm';
import { ProductThumb } from '../components/ProductThumb';
import { ShelfManager } from '../components/ShelfManager';
import { count, describe } from '../format';
import type { Product, Shelf } from '../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { FormField } from '../ui/FormField';
import { Segmented } from '../ui/Segmented';
import { useToast } from '../ui/Toast';

interface Props {
  products: Product[];
  shelves: Shelf[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onGoToScan: () => void;
}

interface Group {
  key: string;
  name: string;
  placed: boolean;
  products: Product[];
}

type Filter = 'all' | 'in' | 'out';

function matches(product: Product, query: string): boolean {
  const haystack = [product.name, product.brand, product.category, product.size, product.shelfName, product.barcode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function Inventory({ products, shelves, canEdit, onChanged, onGoToScan }: Props) {
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [managingShelves, setManagingShelves] = useState(false);

  const groups = useMemo(() => {
    const visible = products.filter(
      (p) =>
        (filter === 'all' || (filter === 'in') === p.quantity > 0) && (!query.trim() || matches(p, query.trim())),
    );
    const byShelf = new Map<number | null, Product[]>();
    for (const product of visible) {
      const list = byShelf.get(product.shelfId) ?? [];
      list.push(product);
      byShelf.set(product.shelfId, list);
    }
    const result: Group[] = shelves
      .filter((shelf) => byShelf.has(shelf.id))
      .map((shelf) => ({ key: String(shelf.id), name: shelf.name, placed: true, products: byShelf.get(shelf.id)! }));
    if (byShelf.has(null)) {
      result.push({ key: 'none', name: 'Not on a shelf yet', placed: false, products: byShelf.get(null)! });
    }
    return result;
  }, [products, shelves, query, filter]);

  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const outCount = products.filter((p) => p.quantity === 0).length;

  async function change(product: Product, delta: number) {
    try {
      await api.changeStock(product.id, delta, 'adjust');
      await onChanged();
    } catch (err) {
      showToast(messageOf(err), 'error');
    }
  }

  async function closeAndReload() {
    setEditing(null);
    await onChanged();
  }

  const dialogs = (
    <>
      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          shelves={shelves}
          onSaved={closeAndReload}
          onDeleted={closeAndReload}
          onClose={() => setEditing(null)}
        />
      )}
      {managingShelves && (
        <ShelfManager shelves={shelves} onChanged={onChanged} onClose={() => setManagingShelves(false)} />
      )}
    </>
  );

  if (products.length === 0) {
    return (
      <>
        <EmptyState
          level={1}
          icon={<PackageOpen size={32} />}
          title="The inventory is empty"
          description={
            canEdit
              ? 'Scan the first item to start counting what is on the shelves.'
              : 'Nothing has been scanned in yet. A volunteer can sign in to start.'
          }
          action={
            canEdit && (
              <>
                <Button variant="cta" size="lg" icon={<ScanBarcode size={20} />} onClick={onGoToScan}>
                  Start scanning
                </Button>
                <Button size="lg" icon={<LayoutList size={20} />} onClick={() => setManagingShelves(true)}>
                  Set up shelves
                </Button>
              </>
            )
          }
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <h1 className="display">On the shelves</h1>
        <div className="page-head-meta">
          <Badge tone="success">{count(totalItems, 'item')}</Badge>
          <Badge>{count(products.length, 'product')}</Badge>
          {outCount > 0 && <Badge tone="danger">{outCount} out of stock</Badge>}
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <FormField
            label={<span className="visually-hidden">Search the pantry</span>}
            type="search"
            placeholder="Search by name, brand, kind or shelf"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Segmented
          label="Show"
          className="filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'in', label: 'In stock' },
            { value: 'out', label: 'Out' },
          ]}
        />
        {canEdit && (
          <div className="toolbar-actions">
            <Button icon={<Plus size={18} />} onClick={() => setEditing('new')}>
              Add item
            </Button>
            <Button variant="ghost" icon={<LayoutList size={18} />} onClick={() => setManagingShelves(true)}>
              Shelves
            </Button>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <EmptyState
          icon={<Search size={30} />}
          title="Nothing matches"
          description="Try a shorter search, or switch back to showing everything."
          action={
            <Button
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Clear search
            </Button>
          }
        />
      )}

      {groups.map((group) => (
        <section key={group.key} className="card shelf">
          <header className={group.placed ? 'shelf-tag' : 'shelf-tag unplaced'}>
            <h2 className="display">{group.name}</h2>
            <span>{count(group.products.reduce((sum, p) => sum + p.quantity, 0), 'item')}</span>
          </header>
          <ul>
            {group.products.map((product) => (
              <li key={product.id} className={product.quantity === 0 ? 'row is-out' : 'row'}>
                <ProductThumb product={product} />
                <div className="row-main">
                  {canEdit ? (
                    <Button variant="link" className="row-name" onClick={() => setEditing(product)}>
                      {product.name}
                    </Button>
                  ) : (
                    <span className="row-name">{product.name}</span>
                  )}
                  <span className="row-meta">
                    <span className="row-detail">{describe(product)}</span>
                    {product.quantity === 1 && <Badge tone="warning">Last one</Badge>}
                  </span>
                </div>
                {canEdit && (
                  <div className="stepper">
                    <Button
                      variant="ghost"
                      iconOnly
                      aria-label={`Take one ${product.name} off`}
                      disabled={product.quantity === 0}
                      icon={<Minus size={18} />}
                      onClick={() => void change(product, -1)}
                    />
                    <Button
                      variant="ghost"
                      iconOnly
                      aria-label={`Add one ${product.name}`}
                      icon={<Plus size={18} />}
                      onClick={() => void change(product, 1)}
                    />
                  </div>
                )}
                {product.quantity === 0 ? (
                  <span className="qty-out">
                    <Badge tone="danger">Out</Badge>
                  </span>
                ) : (
                  <span className="qty display" aria-label={`${product.quantity} in stock`}>
                    {product.quantity}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {dialogs}
    </>
  );
}
