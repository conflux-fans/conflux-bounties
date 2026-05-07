import { PageHeader } from '../components/common/PageHeader';
import { ContractsTable } from '../components/widgets/ContractsTable';
import { ContractsBarChart } from '../components/charts/ContractsBarChart';

/** Contracts analytics page — leaderboard table + bar chart. */
export default function Contracts() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Contracts" subtitle="Top Smart Contracts" widget="contracts" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table — large */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <ContractsTable />
        </div>

        {/* Bar chart — sidebar */}
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">Top 10 by Gas</h3>
          <div className="h-72">
            <ContractsBarChart />
          </div>
        </div>
      </div>
    </div>
  );
}
