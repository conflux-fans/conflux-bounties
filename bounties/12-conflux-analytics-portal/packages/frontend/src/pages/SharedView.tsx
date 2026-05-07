import { useParams } from 'react-router-dom';
import { useSharedView } from '../api/hooks';

/** Read-only shared view page — renders the saved config as a slug. */
export default function SharedView() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useSharedView(slug ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
        Loading shared view...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Not Found</h2>
          <p className="text-gray-400">This shared view doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  const config = data.config as Record<string, string | undefined>;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 bg-accent-green rounded-full" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Shared View</span>
          <span className="text-xs text-gray-300">{slug}</span>
        </div>

        <h2 className="text-2xl font-bold mb-4">
          {config.page ? `${config.page.charAt(0).toUpperCase()}${config.page.slice(1)}` : 'Dashboard'}
        </h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {config.from && (
            <div>
              <span className="text-gray-400">From:</span>{' '}
              <span className="font-semibold">{config.from}</span>
            </div>
          )}
          {config.to && (
            <div>
              <span className="text-gray-400">To:</span>{' '}
              <span className="font-semibold">{config.to}</span>
            </div>
          )}
        </div>

        <pre className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(data.config, null, 2)}
        </pre>
      </div>
    </div>
  );
}
