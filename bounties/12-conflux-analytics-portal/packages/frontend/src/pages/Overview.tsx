import { Activity, Users, Fuel, Box, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { DailyActivityChart } from '../components/charts/DailyActivityChart';
import { ActiveAccountsChart } from '../components/charts/ActiveAccountsChart';
import { GasCategoryChart } from '../components/charts/GasCategoryChart';
import { useNetworkOverview, useDailyActivity, useTransactionStats } from '../api/hooks';

/** Format large numbers into compact human-readable strings. */
function compactNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

/** Overview dashboard page — stat cards + time-series charts. */
export default function Overview() {
  const { data: overview } = useNetworkOverview();
  const { data: activity } = useDailyActivity();
  const { data: txStats } = useTransactionStats();

  const todayRow = activity?.data?.[0];
  const successRate = txStats?.successRate ?? 0;
  const successPct = (successRate * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" subtitle="Conflux eSpace" widget="activity" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Transactions Today"
          value={todayRow?.tx_count?.toLocaleString() ?? '—'}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Active Accounts"
          value={todayRow?.active_accounts?.toLocaleString() ?? '—'}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Avg Gas Price"
          value={overview?.tps?.toFixed(2) ?? '—'}
          change="TPS"
          icon={<Fuel size={18} />}
        />
        <StatCard
          label="Latest Block"
          value={overview?.latestBlock?.toLocaleString() ?? '—'}
          icon={<Box size={18} />}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Activity — large */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark h-80">
          <DailyActivityChart />
        </div>
        {/* Gas Category Donut */}
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark h-80">
          <GasCategoryChart />
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Accounts */}
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark h-72 p-6">
          <ActiveAccountsChart />
        </div>

        {/* Transaction Stats — redesigned */}
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6 flex flex-col">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">Transaction Stats</h3>

          {/* Big numbers */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col items-center p-3 bg-accent-green/5 rounded-2xl overflow-hidden">
              <CheckCircle size={20} className="text-accent-green mb-2 shrink-0" />
              <div className="text-2xl font-bold truncate max-w-full">{txStats?.totalSuccess ? compactNumber(txStats.totalSuccess) : '—'}</div>
              <div className="text-xs text-secondary mt-0.5">Successful</div>
            </div>
            <div className="flex flex-col items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-2xl overflow-hidden">
              <XCircle size={20} className="text-red-400 mb-2 shrink-0" />
              <div className="text-2xl font-bold truncate max-w-full">{txStats?.totalFailure ? compactNumber(txStats.totalFailure) : '—'}</div>
              <div className="text-xs text-secondary mt-0.5">Failed</div>
            </div>
            <div className="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-2xl overflow-hidden">
              <Activity size={20} className="text-blue-500 mb-2 shrink-0" />
              <div className="text-2xl font-bold text-accent-green">{successRate ? `${successPct}%` : '—'}</div>
              <div className="text-xs text-secondary mt-0.5">Success Rate</div>
            </div>
          </div>

          {/* Visual bar */}
          <div className="mt-auto">
            <div className="flex justify-between text-xs text-secondary mb-1.5">
              <span>Success</span>
              <span>Failure</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-accent-green rounded-full transition-all"
                style={{ width: `${successRate * 100}%` }}
              />
              <div
                className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${(1 - successRate) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold mt-1.5">
              <span className="text-accent-green">{successPct}%</span>
              <span className="text-red-400">{(100 - Number(successPct)).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
