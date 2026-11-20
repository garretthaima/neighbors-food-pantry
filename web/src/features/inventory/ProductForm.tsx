import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api, messageOf } from '@/shared/api';
import type { Product, ProductInput, Shelf } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { FormField } from '@/shared/ui/FormField';
import { ResponsivePanel } from '@/shared/ui/ResponsivePanel';
import { useToast } from '@/shared/ui/Toast';

interface Props {
    /** The item being edited, or null when adding a new one. */
    product: Product | null;
    /** Starting values for a new item, such as the barcode that was not found. */
    initial?: Partial<ProductInput>;
    /** Shown above the fields, e.g. why the form opened by itself. */
    note?: string;
    /** Skip the "Item added" toast when the caller shows the result itself. */
    quietOnAdd?: boolean;
    shelves: Shelf[];
    onSaved: (product: Product) => void;
    onDeleted?: () => void;
    onClose: () => void;
}

type FieldErrors = Partial<Record<'name' | 'barcode' | 'quantity', string>>;

export function ProductForm({
    product,
    initial,
    note,
    quietOnAdd,
    shelves,
    onSaved,
    onDeleted,
    onClose,
}: Props) {
    const formId = useId();
    const showToast = useToast();
    const [form, setForm] = useState({
        name: product?.name ?? initial?.name ?? '',
        brand: product?.brand ?? initial?.brand ?? '',
        size: product?.size ?? initial?.size ?? '',
        category: product?.category ?? initial?.category ?? '',
        barcode: product?.barcode ?? initial?.barcode ?? '',
        shelfId: String(product?.shelfId ?? initial?.shelfId ?? ''),
        quantity: String(product?.quantity ?? initial?.quantity ?? 1),
    });
    const [errors, setErrors] = useState<FieldErrors>({});
    const [busy, setBusy] = useState(false);
    const [confirmingRemove, setConfirmingRemove] = useState(false);

    const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
        setForm((current) => ({ ...current, [field]: event.target.value }));

    async function save(event: FormEvent) {
        event.preventDefault();
        const quantity = Number(form.quantity);
        const found: FieldErrors = {};
        if (!form.name.trim()) found.name = 'Give the item a name.';
        if (form.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 0) {
            found.quantity = 'Use a whole number, 0 or more.';
        }
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        const input: ProductInput = {
            name: form.name,
            brand: form.brand,
            size: form.size,
            category: form.category,
            barcode: form.barcode,
            shelfId: form.shelfId ? Number(form.shelfId) : null,
            quantity,
        };
        setBusy(true);
        try {
            const saved = product
                ? await api.updateProduct(product.id, input)
                : await api.createProduct(input);
            if (product) showToast('Changes saved');
            else if (!quietOnAdd) showToast('Item added');
            onSaved(saved);
        } catch (err) {
            const message = messageOf(err);
            // The server's barcode complaints belong on the barcode field.
            if (err instanceof ApiError && /barcode/i.test(message))
                setErrors({ barcode: message });
            else showToast(message, 'error');
            setBusy(false);
        }
    }

    async function remove() {
        try {
            await api.deleteProduct(product!.id);
            showToast('Item removed');
            onDeleted?.();
        } catch (err) {
            showToast(messageOf(err), 'error');
            setConfirmingRemove(false);
        }
    }

    return (
        <ResponsivePanel
            title={product ? 'Edit item' : 'Add item'}
            onClose={onClose}
            closeDisabled={busy}
            footer={
                <>
                    {product && (
                        <Button
                            variant="danger-outline"
                            className="push-left"
                            icon={<Trash2 size={18} />}
                            onClick={() => setConfirmingRemove(true)}
                            disabled={busy}
                        >
                            Remove item
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" form={formId} variant="primary" disabled={busy}>
                        {product ? 'Save changes' : 'Add item'}
                    </Button>
                </>
            }
        >
            {note && <p className="form-note">{note}</p>}
            <form id={formId} className="form-grid" onSubmit={save} noValidate>
                <FormField
                    className="wide"
                    label="Name"
                    value={form.name}
                    onChange={set('name')}
                    error={errors.name}
                    aria-required="true"
                    autoFocus
                    maxLength={200}
                />
                <FormField
                    label="Brand"
                    value={form.brand}
                    onChange={set('brand')}
                    maxLength={200}
                />
                <FormField
                    label="Size"
                    value={form.size}
                    onChange={set('size')}
                    placeholder="15 oz"
                    maxLength={200}
                />
                <FormField
                    label="Kind of food"
                    value={form.category}
                    onChange={set('category')}
                    placeholder="Canned vegetables"
                    maxLength={200}
                />
                <FormField
                    label="Barcode"
                    value={form.barcode}
                    onChange={set('barcode')}
                    error={errors.barcode}
                    hint="Leave empty if it has none."
                    inputMode="numeric"
                />
                <FormField
                    control="select"
                    label="Shelf"
                    value={form.shelfId}
                    onChange={set('shelfId')}
                >
                    <option value="">Not on a shelf yet</option>
                    {shelves.map((shelf) => (
                        <option key={shelf.id} value={shelf.id}>
                            {shelf.name}
                        </option>
                    ))}
                </FormField>
                <FormField
                    label="How many"
                    value={form.quantity}
                    onChange={set('quantity')}
                    error={errors.quantity}
                    aria-required="true"
                    inputMode="numeric"
                />
            </form>

            {confirmingRemove && product && (
                <ConfirmDialog
                    title="Remove this item?"
                    confirmLabel="Remove item"
                    onConfirm={remove}
                    onClose={() => setConfirmingRemove(false)}
                >
                    <p>
                        <strong>{product.name}</strong> and its history will be deleted from the
                        inventory. To record that you have run out, set how many to 0 instead.
                    </p>
                </ConfirmDialog>
            )}
        </ResponsivePanel>
    );
}
