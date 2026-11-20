import { ArrowDownToLine, ArrowUpFromLine, Camera, CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, messageOf } from '@/shared/api';
import { beep } from './beep';
import { CameraScanner } from './CameraScanner';
import { ScanLog } from './ScanLog';
import type { Entry, OkEntry } from './ScanLog';
import { ProductForm } from '@/features/inventory';
import type { ScanMode, Shelf } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';
import { Segmented } from '@/shared/ui/Segmented';
import { useToast } from '@/shared/ui/Toast';

interface Props {
    shelves: Shelf[];
    onChanged: () => Promise<void>;
}

type WithoutKey<T> = T extends unknown ? Omit<T, 'key'> : never;

export function Scan({ shelves, onChanged }: Props) {
    const showToast = useToast();
    const [mode, setMode] = useState<ScanMode>('in');
    const [shelfId, setShelfId] = useState('');
    const [code, setCode] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const [unknown, setUnknown] = useState<string | null>(null);
    const [camera, setCamera] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const nextKey = useRef(1);
    const busy = useRef(false);

    // A scanner types into whatever has focus. If a button was clicked last,
    // send the next digits to the barcode box instead of losing them.
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            const typingElsewhere = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
            if (
                !typingElsewhere &&
                /^\d$/.test(event.key) &&
                !document.querySelector('dialog[open]')
            ) {
                inputRef.current?.focus();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    function add(entry: WithoutKey<Entry>) {
        setEntries((current) =>
            [{ ...entry, key: nextKey.current++ } as Entry, ...current].slice(0, 30)
        );
    }

    // Scan results go in the list below rather than a toast: that is where a
    // volunteer is already looking, and the list is the record of the session.
    async function scan(barcode: string) {
        if (busy.current || !barcode.trim()) return;
        busy.current = true;
        try {
            const result = await api.scan(barcode.trim(), mode, shelfId ? Number(shelfId) : null);
            if (result.status === 'ok') {
                beep(true);
                add({
                    kind: 'ok',
                    mode,
                    product: result.product,
                    isNew: result.created,
                    undone: false,
                });
                void onChanged();
            } else if (mode === 'in') {
                beep(false);
                setUnknown(result.barcode);
            } else {
                beep(false);
                add({
                    kind: 'problem',
                    message: `Barcode ${result.barcode} is not in the inventory, so nothing was taken off.`,
                });
            }
        } catch (err) {
            beep(false);
            add({ kind: 'problem', message: messageOf(err) });
        } finally {
            busy.current = false;
            setCode('');
            inputRef.current?.focus();
        }
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        void scan(code);
    }

    async function undo(entry: OkEntry) {
        try {
            await api.changeStock(entry.product.id, entry.mode === 'in' ? -1 : 1, 'adjust');
            setEntries((current) =>
                current.map((e) => (e.key === entry.key ? { ...entry, undone: true } : e))
            );
            showToast('Scan undone');
            void onChanged();
        } catch (err) {
            showToast(messageOf(err), 'error');
        }
        inputRef.current?.focus();
    }

    const receiving = mode === 'in';

    return (
        <>
            <h1 className="visually-hidden">Scan</h1>
            {/* The card takes the colour of the mode, so nobody gives food out
          while the screen is still set to receiving. */}
            <section className={receiving ? 'card scan-card' : 'card scan-card is-giving'}>
                <Segmented
                    label="What are you doing?"
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'in', label: 'Receiving', icon: <ArrowDownToLine size={18} /> },
                        { value: 'out', label: 'Giving out', icon: <ArrowUpFromLine size={18} /> },
                    ]}
                />

                <form className="scan-form" onSubmit={submit}>
                    <label htmlFor="barcode" className="scan-label">
                        {receiving
                            ? 'Scan each item as it goes on the shelf'
                            : 'Scan each item as it leaves'}
                    </label>
                    <div className="scan-row">
                        <input
                            id="barcode"
                            ref={inputRef}
                            className="control scan-input"
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            inputMode="numeric"
                            autoComplete="off"
                            autoFocus
                            placeholder="Barcode"
                        />
                        <Button type="submit" variant={receiving ? 'primary' : 'danger'} size="lg">
                            {receiving ? 'Receive' : 'Give out'}
                        </Button>
                    </div>
                </form>

                <div className="scan-options">
                    {receiving && (
                        <FormField
                            control="select"
                            label="Put on shelf"
                            value={shelfId}
                            onChange={(event) => setShelfId(event.target.value)}
                        >
                            <option value="">Leave where it is</option>
                            {shelves.map((shelf) => (
                                <option key={shelf.id} value={shelf.id}>
                                    {shelf.name}
                                </option>
                            ))}
                        </FormField>
                    )}
                    <Button
                        icon={camera ? <CameraOff size={18} /> : <Camera size={18} />}
                        onClick={() => setCamera((on) => !on)}
                    >
                        {camera ? 'Turn camera off' : 'Scan with the camera'}
                    </Button>
                </div>

                {camera && <CameraScanner onScan={(barcode) => void scan(barcode)} />}
            </section>

            <ScanLog entries={entries} onUndo={(entry) => void undo(entry)} />

            {unknown && (
                <ProductForm
                    product={null}
                    quietOnAdd
                    note={`Barcode ${unknown} is not in the lookup services. Type what it is once and the pantry will remember it.`}
                    initial={{
                        barcode: unknown,
                        shelfId: shelfId ? Number(shelfId) : null,
                        quantity: 1,
                    }}
                    shelves={shelves}
                    onSaved={(product) => {
                        setUnknown(null);
                        add({ kind: 'ok', mode: 'in', product, isNew: true, undone: false });
                        void onChanged();
                        inputRef.current?.focus();
                    }}
                    onClose={() => {
                        setUnknown(null);
                        inputRef.current?.focus();
                    }}
                />
            )}
        </>
    );
}
