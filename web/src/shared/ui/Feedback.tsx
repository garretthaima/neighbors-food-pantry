import { RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

/** A failed load. Always offers a retry, so nobody has to reload the page. */
export function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="error-alert" role="alert">
            <p>{message}</p>
            <Button
                variant="danger-outline"
                size="sm"
                icon={<RotateCw size={16} />}
                onClick={onRetry}
            >
                Try again
            </Button>
        </div>
    );
}

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: ReactNode;
    action?: ReactNode;
    /** Heading level of the title: 1 when it is the page's only heading. */
    level?: 1 | 2;
}

/** An empty screen says what belongs here and how to put it there. */
export function EmptyState({ icon, title, description, action, level = 2 }: EmptyStateProps) {
    const Heading = level === 1 ? 'h1' : 'h2';
    return (
        <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
                {icon}
            </div>
            <Heading className="display">{title}</Heading>
            <p>{description}</p>
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
}

/** Placeholder rows shown while a list loads, in place of a "Loading" line. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
    return (
        <div className="skeleton-rows" role="status">
            <span className="visually-hidden">Loading</span>
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="skeleton skeleton-row" aria-hidden="true" />
            ))}
        </div>
    );
}
