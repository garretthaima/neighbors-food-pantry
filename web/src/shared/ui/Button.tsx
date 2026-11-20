import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Which one to use:
 *  cta             the single most important action on a screen (at most one)
 *  primary         confirms a form or dialog
 *  secondary       other actions that sit beside a primary or cta
 *  ghost           low-emphasis actions repeated per row (undo, close, steppers)
 *  danger          confirms something destructive, inside a confirm dialog
 *  danger-outline  opens a destructive flow
 *  link            a row's title that opens that row
 */
export type ButtonVariant =
    'cta' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Icon shown before the label. */
    icon?: ReactNode;
    /** Square button holding only an icon. Requires aria-label. */
    iconOnly?: boolean;
    block?: boolean;
}

export function Button({
    variant = 'secondary',
    size = 'md',
    icon,
    iconOnly = false,
    block = false,
    type = 'button',
    className,
    children,
    ...rest
}: Props) {
    const classes = [
        'btn',
        `btn-${variant}`,
        size !== 'md' && `btn-${size}`,
        iconOnly && 'btn-icon',
        block && 'btn-block',
        className,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <button type={type} className={classes} {...rest}>
            {icon}
            {children}
        </button>
    );
}
