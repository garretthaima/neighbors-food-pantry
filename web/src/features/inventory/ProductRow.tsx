import { Minus, Plus } from 'lucide-react';
import { ProductThumb } from './ProductThumb';
import { describe } from '@/shared/format';
import type { Product } from '@/shared/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';

interface Props {
    product: Product;
    canEdit: boolean;
    onEdit: (product: Product) => void;
    onChange: (product: Product, delta: number) => void;
}

/** One product on a shelf: photo, name, count and, for volunteers, the +/- buttons. */
export function ProductRow({ product, canEdit, onEdit, onChange }: Props) {
    return (
        <li className={product.quantity === 0 ? 'row is-out' : 'row'}>
            <ProductThumb product={product} />
            <div className="row-main">
                {canEdit ? (
                    <Button variant="link" className="row-name" onClick={() => onEdit(product)}>
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
                        onClick={() => onChange(product, -1)}
                    />
                    <Button
                        variant="ghost"
                        iconOnly
                        aria-label={`Add one ${product.name}`}
                        icon={<Plus size={18} />}
                        onClick={() => onChange(product, 1)}
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
    );
}
