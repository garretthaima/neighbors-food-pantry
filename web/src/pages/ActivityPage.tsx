import { ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, messageOf } from '../api';
import type { Activity } from '../types';
import { EmptyState, ErrorAlert, SkeletonRows } from '../ui/Feedback';

const when = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const REASON = { in: 'Received', out: 'Given out', adjust: 'Count corrected' } as const;

export function ActivityPage() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.activity().then(setActivity, (err) => setError(messageOf(err)));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <header className="page-head">
        <h1 className="display">Last 30 days</h1>
      </header>

      {error ? (
        <ErrorAlert message={error} onRetry={load} />
      ) : !activity ? (
        <SkeletonRows />
      ) : (
        <>
          <dl className="stats">
            <div className="card stat">
              <dt>
                <ArrowDownToLine size={18} aria-hidden="true" /> Items received
              </dt>
              <dd className="display">{activity.last30Days.received.toLocaleString()}</dd>
            </div>
            <div className="card stat">
              <dt>
                <ArrowUpFromLine size={18} aria-hidden="true" /> Items given out
              </dt>
              <dd className="display">{activity.last30Days.givenOut.toLocaleString()}</dd>
            </div>
          </dl>

          {activity.events.length === 0 ? (
            <EmptyState
              icon={<History size={32} />}
              title="No activity yet"
              description="Every scan and count change will be listed here."
            />
          ) : (
            <section className="card">
              <h2 className="card-title">Recent changes</h2>
              <ul>
                {activity.events.map((event) => (
                  <li key={event.id} className="row">
                    <span className={event.delta > 0 ? 'delta display is-plus' : 'delta display is-minus'}>
                      {event.delta > 0 ? `+${event.delta}` : `−${Math.abs(event.delta)}`}
                    </span>
                    <div className="row-main">
                      <span className="row-name">{event.productName}</span>
                      <span className="row-detail">
                        {REASON[event.reason]}, {when.format(new Date(event.createdAt))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
