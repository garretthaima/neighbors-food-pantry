import { ScanBarcode, Undo2 } from 'lucide-react';
import { ProductThumb } from '@/features/inventory';
import { count, describe } from '@/shared/format';
import type { Product, ScanMode } from '@/shared/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Feedback';

/** One line of the session's scan record. */
export type Entry =
    | { key: number; kind: 'ok'; mode: ScanMode; product: Product; isNew: boolean; undone: boolean }
    | { key: number; kind: 'problem'; message: string };

export type OkEntry = Extract<Entry, { kind: 'ok' }>;

interface Props {
    entries: Entry[];
    onUndo: (entry: OkEntry) => void;
}

/** What was scanned this session, newest first, each with an undo. */
export function ScanLog({ entries, onUndo }: Props) {
    return (
        <div aria-live="polite">
            {entries.length === 0 ? (
                <EmptyState
                    icon={<ScanBarcode size={32} />}
                    title="Ready to scan"
                    description="Each item you scan shows up here, newest first, with an undo for mistakes."
                />
            ) : (
                <ul className="card scan-log">
                    {entries.map((entry, index) =>
                        entry.kind === 'problem' ? (
                            <li key={entry.key} className="row is-problem">
                                {entry.message}
                            </li>
                        ) : (
                            <li key={entry.key} className={index === 0 ? 'row is-latest' : 'row'}>
                                <ProductThumb
                                    product={entry.product}
                                    size={index === 0 ? 'lg' : 'md'}
                                />
                                <div className="row-main">
                                    <span className="row-name">{entry.product.name}</span>
                                    <span className="row-detail">{describe(entry.product)}</span>
                                    <span className="row-badges">
                                        {entry.undone ? (
                                            <Badge>Undone</Badge>
                                        ) : (
                                            <Badge
                                                tone={
                                                    entry.product.quantity === 0
                                                        ? 'danger'
                                                        : 'success'
                                                }
                                            >
                                                {entry.product.quantity === 0
                                                    ? 'None left'
                                                    : `${count(entry.product.quantity, 'item')} in stock`}
                                            </Badge>
                                        )}
                                        <Badge>
                                            {entry.product.shelfName ?? 'Not on a shelf yet'}
                                        </Badge>
                                        {entry.isNew && <Badge tone="tag">New to the pantry</Badge>}
                                    </span>
                                </div>
                                {!entry.undone && (
                                    <Button
                                        variant="ghost"
                                        icon={<Undo2 size={18} />}
                                        onClick={() => onUndo(entry)}
                                    >
                                        Undo
                                    </Button>
                                )}
                                <span
                                    className={
                                        entry.mode === 'in'
                                            ? 'delta display is-plus'
                                            : 'delta display is-minus'
                                    }
                                >
                                    {entry.mode === 'in' ? '+1' : '−1'}
                                </span>
                            </li>
                        )
                    )}
                </ul>
            )}
        </div>
    );
}
