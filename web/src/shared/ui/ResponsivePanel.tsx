import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface Props {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** Action buttons. On a phone they stack full-width at the bottom. */
    footer?: ReactNode;
    size?: 'sm' | 'md';
    /** Blocks closing while a save is in flight. */
    closeDisabled?: boolean;
}

/**
 * Every dialog in the app: a centred modal from 768px, a bottom sheet below.
 * Built on the native <dialog>, which owns the focus trap, Escape and the
 * backdrop, so nothing here hand-rolls them.
 */
export function ResponsivePanel({
    title,
    onClose,
    children,
    footer,
    size = 'md',
    closeDisabled = false,
}: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current!;
        if (!dialog.open) dialog.showModal();
        return () => dialog.close();
    }, []);

    return (
        <dialog
            ref={ref}
            className={size === 'sm' ? 'panel panel-sm' : 'panel'}
            aria-label={title}
            onCancel={(event) => {
                event.preventDefault();
                if (!closeDisabled) onClose();
            }}
        >
            <header className="panel-head">
                <h2 className="display">{title}</h2>
                <Button
                    variant="ghost"
                    iconOnly
                    aria-label="Close"
                    onClick={onClose}
                    disabled={closeDisabled}
                    icon={<X />}
                />
            </header>
            <div className="panel-body">{children}</div>
            {footer && <footer className="panel-foot">{footer}</footer>}
        </dialog>
    );
}
