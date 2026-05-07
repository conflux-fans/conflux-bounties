import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';

/** Light/dark theme toggle button. */
export function ThemeToggle() {
  const { dark, toggle } = useThemeStore();

  return (
    <div className="relative group">
      <button
        onClick={toggle}
        className="w-10 h-10 bg-white dark:bg-card-dark rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-300 border border-border dark:border-border-dark transition-colors"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 bg-primary dark:bg-primary-dark text-white dark:text-black text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
        {dark ? 'Light mode' : 'Dark mode'}
      </span>
    </div>
  );
}
