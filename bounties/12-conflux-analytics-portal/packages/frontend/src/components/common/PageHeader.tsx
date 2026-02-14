import { type ReactNode } from 'react';
import { DateRangePicker } from './DateRangePicker';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  widget: string;
  children?: ReactNode;
}

/** Page header with title, date picker, export, and share controls. */
export function PageHeader({ title, subtitle, widget, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && (
          <div className="flex items-center text-secondary font-medium text-sm mt-1 gap-2">
            <div className="w-1.5 h-1.5 bg-accent-green rounded-full" />
            <span className="text-gray-400">{subtitle}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {children}
        <DateRangePicker />
        <div className="bg-white dark:bg-card-dark rounded-xl p-1.5 flex items-center shadow-sm gap-1 border border-border dark:border-border-dark">
          <ExportButton widget={widget} />
        </div>
        <ShareButton page={widget} />
      </div>
    </div>
  );
}
