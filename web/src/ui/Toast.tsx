import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

type Tone = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

// Errors stay long enough to read and always carry a close button.
const DURATION_MS: Record<Tone, number> = { success: 4000, error: 10_000 };

/**
 * Feedback for something the person just did (saved, removed, failed to
 * save). Failed page loads use <ErrorAlert> instead.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const regionRef = useRef<HTMLDivElement>(null);

  // Dialogs open in the browser's top layer, above everything in the page.
  // Showing the toast region as a popover puts it there too, and re-showing
  // it for each new toast lifts it over a dialog that opened in between.
  useEffect(() => {
    const region = regionRef.current;
    if (!region?.showPopover) return;
    if (region.matches(':popover-open')) region.hidePopover();
    if (toasts.length > 0) region.showPopover();
  }, [toasts]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div ref={regionRef} className="toasts" popover="manual" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={toast.tone === 'error' ? 'toast toast-error' : 'toast'}>
            <p>{toast.message}</p>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Dismiss"
              icon={<X size={18} />}
              onClick={() => dismiss(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
