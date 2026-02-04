import { Flame, TrendingUp, Banknote } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { GasPriceChart } from '../components/charts/GasPriceChart';
import { FeesChart } from '../components/charts/FeesChart';
import { useDailyFees } from '../api/hooks';

/** Format large numbers into compact human-readable strings. */
function compactNumber(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e18) return (n / 1e18).toFixed(2) + ' ETH';
  if (abs >= 1e15) return (n / 1e15).toFixed(2) + 'P';
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toLocaleString();
}

/** Fees analytics page — gas price chart, burned vs tips, stat cards. */
export default function Fees() {
  const { data } = useDailyFees();
  const rows = data?.data ?? [];

  const latestAvg = rows[0]?.avg_gas_price ? compactNumber(Number(rows[0].avg_gas_price)) : '—';
  const totalBurned = rows.reduce((s, r) => s + Number(r.total_burned), 0);
  const totalTips = rows.reduce((s, r) => s + Number(r.total_tips), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fees" subtitle="Gas Analytics" widget="fees" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Avg Gas Price" value={latestAvg} icon={<Flame size={18} />} />
        <StatCard label="Total Burned" value={compactNumber(totalBurned)} icon={<TrendingUp size={18} />} />
        <StatCard label="Total Tips" value={compactNumber(totalTips)} icon={<Banknote size={18} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <div className="h-72">
            <GasPriceChart />
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">Burned vs Tips</h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#6366F1' }} />
                <span className="text-secondary">Burned</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-accent-green" />
                <span className="text-secondary">Tips</span>
              </div>
            </div>
          </div>
          <div className="h-72">
            <FeesChart />
          </div>
        </div>
      </div>
    </div>
  );
}
