import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface Shared {
    /** Always rendered. Wrap in .visually-hidden text for toolbar controls. */
    label: ReactNode;
    hint?: string;
    /** Shown under the control and announced; ties to it via aria-describedby. */
    error?: string;
    className?: string;
}

type InputProps = Shared & { control?: 'input' } & Omit<
        InputHTMLAttributes<HTMLInputElement>,
        'className'
    >;
type SelectProps = Shared & { control: 'select'; children: ReactNode } & Omit<
        SelectHTMLAttributes<HTMLSelectElement>,
        'className'
    >;

/** A labelled input or select with its hint and per-field error. */
export function FormField(props: InputProps | SelectProps) {
    const id = useId();
    const { label, hint, error, className, control, ...rest } = props;
    const describedBy =
        [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
    const shared = {
        id,
        className: 'control',
        'aria-describedby': describedBy,
        'aria-invalid': error ? (true as const) : undefined,
    };

    return (
        <div className={className ? `field ${className}` : 'field'}>
            <label className="field-label" htmlFor={id}>
                {label}
            </label>
            {control === 'select' ? (
                <select {...(rest as SelectHTMLAttributes<HTMLSelectElement>)} {...shared} />
            ) : (
                <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...shared} />
            )}
            {hint && !error && (
                <span id={`${id}-hint`} className="field-hint">
                    {hint}
                </span>
            )}
            {error && (
                <span id={`${id}-error`} className="field-error" role="alert">
                    {error}
                </span>
            )}
        </div>
    );
}
