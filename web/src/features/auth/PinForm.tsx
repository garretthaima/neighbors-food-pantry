import { LogIn } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, messageOf } from '@/shared/api';
import { Button } from '@/shared/ui/Button';
import { FormField } from '@/shared/ui/FormField';

interface Props {
    label: string;
    onSignedIn: () => void;
}

export function PinForm({ label, onSignedIn }: Props) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!pin) {
            setError('Type the PIN first.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await api.login(pin);
            onSignedIn();
        } catch (err) {
            setError(messageOf(err));
            setPin('');
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="pin-form" onSubmit={submit} noValidate>
            <FormField
                label={label}
                error={error}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                aria-required="true"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
            />
            <Button
                type="submit"
                variant="primary"
                block
                disabled={busy}
                icon={<LogIn size={18} />}
            >
                Sign in
            </Button>
        </form>
    );
}
