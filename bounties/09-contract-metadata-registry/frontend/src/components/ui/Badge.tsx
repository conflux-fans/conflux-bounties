'use client';

import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[rgb(var(--color-accent))]/20 text-[rgb(var(--color-accent))]',
  success: 'bg-[rgb(var(--color-success))]/20 text-[rgb(var(--color-success))]',
  warning: 'bg-[rgb(var(--color-warning))]/20 text-[rgb(var(--color-warning))]',
  danger: 'bg-[rgb(var(--color-danger))]/20 text-[rgb(var(--color-danger))]',
  muted: 'bg-[rgb(var(--color-bg-muted))] text-[rgb(var(--color-text-muted))]',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
