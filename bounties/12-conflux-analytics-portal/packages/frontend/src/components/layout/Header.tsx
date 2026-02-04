import { useLocation, Link } from 'react-router-dom';
import {
  Activity,
  FileCode,
  Coins,
  LayoutGrid,
  Flame,
  Search,
  Bell,
} from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';

const NAV_ITEMS = [
  { to: '/', icon: Activity, label: 'Overview' },
  { to: '/contracts', icon: FileCode, label: 'Contracts' },
  { to: '/tokens', icon: Coins, label: 'Tokens' },
  { to: '/dapps', icon: LayoutGrid, label: 'DApps' },
  { to: '/fees', icon: Flame, label: 'Fees' },
];

/** Top navigation bar — mirrors the design system from frontend-design. */
export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="flex items-center justify-between py-6 px-8">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary dark:text-primary-dark">
          <path d="M12 2l9 4.9V17L12 22l-9-4.9V6.9L12 2z" />
          <path d="M12 22V12" />
          <path d="M12 12L2.95 6.95" />
          <path d="M12 12l9.05-5.05" />
        </svg>
        <span className="font-bold text-xl tracking-tight">Conflux Analytics</span>
      </Link>

      {/* Center Nav */}
      <div className="bg-white dark:bg-card-dark rounded-2xl p-1.5 flex items-center gap-1 shadow-sm border border-border dark:border-border-dark">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`relative group p-2.5 rounded-xl transition-colors ${
                active
                  ? 'bg-primary text-white dark:bg-primary-dark dark:text-black'
                  : 'text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={20} />
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-primary dark:bg-primary-dark text-white dark:text-black text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Address, Txn, Block..."
            className="pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-card-dark text-sm w-56 focus:outline-none focus:ring-2 focus:ring-accent-green/30 placeholder-gray-400 shadow-sm border border-border dark:border-border-dark"
          />
        </div>

        <ThemeToggle />

        <div className="relative group">
          <button className="w-10 h-10 bg-white dark:bg-card-dark rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-300 border border-border dark:border-border-dark transition-colors">
            <Bell size={18} />
          </button>
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-primary dark:bg-primary-dark text-white dark:text-black text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
            Notifications
          </span>
        </div>
      </div>
    </header>
  );
}
