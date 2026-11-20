import { Package } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/shared/types';

interface Props {
    product: Pick<Product, 'imageUrl'>;
    size?: 'md' | 'lg';
}

/** The product photo from the barcode lookup, or a plain box icon without one. */
export function ProductThumb({ product, size = 'md' }: Props) {
    const [failed, setFailed] = useState(false);
    const className = size === 'lg' ? 'thumb thumb-lg' : 'thumb';

    if (!product.imageUrl || failed) {
        return (
            <span className={className} aria-hidden="true">
                <Package size={size === 'lg' ? 34 : 22} />
            </span>
        );
    }
    return (
        <span className={className}>
            <img
                src={product.imageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
            />
        </span>
    );
}
