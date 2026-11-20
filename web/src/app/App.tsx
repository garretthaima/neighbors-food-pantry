import { History, KeyRound, LayoutList, LogIn, LogOut, ScanBarcode } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, messageOf } from '@/shared/api';
import { PinForm } from '@/features/auth';
import { ActivityPage } from '@/features/activity';
import { Inventory } from '@/features/inventory';
import { Scan } from '@/features/scan';
import type { Me, Product, Shelf } from '@/shared/types';
import { Button } from '@/shared/ui/Button';
import { ErrorAlert, SkeletonRows } from '@/shared/ui/Feedback';
import { ResponsivePanel } from '@/shared/ui/ResponsivePanel';
import { ToastProvider, useToast } from '@/shared/ui/Toast';

type Tab = 'shelves' | 'scan' | 'activity';

const TABS = [
    { id: 'shelves', label: 'Shelves', Icon: LayoutList },
    { id: 'scan', label: 'Scan', Icon: ScanBarcode },
    { id: 'activity', label: 'Activity', Icon: History },
] as const;

function tabFromHash(): Tab {
    const id = window.location.hash.replace(/^#\/?/, '');
    return TABS.find((tab) => tab.id === id)?.id ?? 'shelves';
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

function Shell() {
    const showToast = useToast();
    const [me, setMe] = useState<Me | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [shelves, setShelves] = useState<Shelf[]>([]);
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const [tab, setTab] = useState<Tab>(tabFromHash);
    const [signingIn, setSigningIn] = useState(false);

    /** Refreshes the lists. A failure after the first load keeps what is shown. */
    const reload = useCallback(async () => {
        try {
            const [nextProducts, nextShelves] = await Promise.all([api.products(), api.shelves()]);
            setProducts(nextProducts);
            setShelves(nextShelves);
            setLoad({ status: 'ready' });
        } catch (err) {
            setLoad((current) => {
                if (current.status === 'ready') {
                    showToast(messageOf(err), 'error');
                    return current;
                }
                return { status: 'error', message: messageOf(err) };
            });
        }
    }, [showToast]);

    const start = useCallback(async () => {
        setLoad({ status: 'loading' });
        try {
            const current = await api.me();
            setMe(current);
            if (current.role) await reload();
        } catch (err) {
            setLoad({ status: 'error', message: messageOf(err) });
        }
    }, [reload]);

    useEffect(() => {
        void start();
        const onHash = () => setTab(tabFromHash());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, [start]);

    async function signOut() {
        try {
            await api.logout();
            showToast('Signed out');
        } catch (err) {
            showToast(messageOf(err), 'error');
        }
        await start();
    }

    const canEdit = me?.role === 'editor';

    let page;
    if (load.status === 'error') {
        page = <ErrorAlert message={load.message} onRetry={() => void start()} />;
    } else if (!me) {
        page = <SkeletonRows />;
    } else if (!me.role || (tab === 'scan' && !canEdit)) {
        page = (
            <section className="card gate">
                <div className="empty-state-icon" aria-hidden="true">
                    <KeyRound size={30} />
                </div>
                <h1 className="display">
                    {me.role ? 'Sign in to scan' : 'Enter the PIN to see the pantry'}
                </h1>
                {me.role && <p>Scanning changes the counts, so it needs the volunteer PIN.</p>}
                <PinForm
                    label={me.role ? 'Volunteer PIN' : 'PIN'}
                    onSignedIn={() => void start()}
                />
            </section>
        );
    } else if (load.status === 'loading') {
        page = <SkeletonRows />;
    } else if (tab === 'scan') {
        page = <Scan shelves={shelves} onChanged={reload} />;
    } else if (tab === 'activity') {
        page = <ActivityPage />;
    } else {
        page = (
            <Inventory
                products={products}
                shelves={shelves}
                canEdit={canEdit}
                onChanged={reload}
                onGoToScan={() => {
                    window.location.hash = '/scan';
                }}
            />
        );
    }

    return (
        <>
            <header className="masthead">
                <div className="masthead-inner">
                    <a className="wordmark display" href="#/shelves">
                        <span className="wordmark-mark" aria-hidden="true" />
                        Food Pantry
                    </a>
                    {/* One nav: sits in the masthead on wide screens and is anchored
              to the bottom, at the thumb, on a phone. */}
                    <nav className="main-nav" aria-label="Sections">
                        {TABS.map(({ id, label, Icon }) => (
                            <a
                                key={id}
                                href={`#/${id}`}
                                aria-current={tab === id ? 'page' : undefined}
                            >
                                <Icon size={20} aria-hidden="true" />
                                {label}
                            </a>
                        ))}
                    </nav>
                    {me?.role &&
                        (canEdit ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<LogOut size={16} />}
                                onClick={() => void signOut()}
                            >
                                Sign out
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                icon={<LogIn size={16} />}
                                onClick={() => setSigningIn(true)}
                            >
                                Volunteer sign in
                            </Button>
                        ))}
                </div>
            </header>

            <main>{page}</main>

            {signingIn && (
                <ResponsivePanel
                    title="Volunteer sign in"
                    size="sm"
                    onClose={() => setSigningIn(false)}
                >
                    <PinForm
                        label="Volunteer PIN"
                        onSignedIn={() => {
                            setSigningIn(false);
                            void start();
                        }}
                    />
                </ResponsivePanel>
            )}
        </>
    );
}

export default function App() {
    return (
        <ToastProvider>
            <Shell />
        </ToastProvider>
    );
}
