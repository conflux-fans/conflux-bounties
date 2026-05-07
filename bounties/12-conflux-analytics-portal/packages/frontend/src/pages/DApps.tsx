import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DappLeaderboard } from '../components/widgets/DappLeaderboard';
import { DappTreemap } from '../components/charts/DappTreemap';

const CATEGORIES = ['All', 'DeFi', 'NFT', 'Infrastructure', 'Gaming', 'Social'];

/** DApps analytics page — leaderboard + treemap with category filter. */
export default function DApps() {
  const [category, setCategory] = useState<string>('All');
  const activeCategory = category === 'All' ? undefined : category;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="DApps" subtitle="Application Leaderboard" widget="dapps">
        {/* Category filter pills */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-1.5 flex items-center gap-1 shadow-sm border border-border dark:border-border-dark">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                category === cat
                  ? 'bg-primary text-white dark:bg-primary-dark dark:text-black'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leaderboard table */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <DappLeaderboard category={activeCategory} />
        </div>

        {/* Treemap */}
        <div className="bg-white dark:bg-card-dark rounded-4xl shadow-sm border border-border dark:border-border-dark p-6">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">Gas Distribution</h3>
          <div className="h-72">
            <DappTreemap category={activeCategory} />
          </div>
        </div>
      </div>
    </div>
  );
}
