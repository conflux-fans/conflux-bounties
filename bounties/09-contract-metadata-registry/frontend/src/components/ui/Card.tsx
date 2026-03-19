'use client';

import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ className, padding = 'md', children, ...props }: CardProps) {
  return (
    <div className={clsx('card', paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('mb-4 border-b border-[rgb(var(--color-border))]/50 pb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx('text-lg font-semibold text-[rgb(var(--color-text))]', className)} {...props} />;
}
