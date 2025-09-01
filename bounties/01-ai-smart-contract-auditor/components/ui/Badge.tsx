'use client';

import { forwardRef, HTMLAttributes } from 'react';
import './badge.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  disabled?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      interactive = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const combinedClassName = [
      'badge',
      `badge-${variant}`,
      `badge-${size}`,
      interactive && 'badge-interactive',
      disabled && 'badge-disabled',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span
        ref={ref}
        className={combinedClassName}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };

// Specialized severity badge for audit reports
interface SeverityBadgeProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  count?: number;
  className?: string;
  interactive?: boolean;
}

export function SeverityBadge({
  severity,
  count,
  className = '',
  interactive = false,
}: SeverityBadgeProps) {
  const severityConfig = {
    critical: { emoji: '🔴', variant: 'error' as const, label: 'Critical' },
    high:     { emoji: '🟠', variant: 'warning' as const, label: 'High'     },
    medium:   { emoji: '🟡', variant: 'info' as const,    label: 'Medium'   },
    low:      { emoji: '🟢', variant: 'success' as const, label: 'Low'      },
  } as const;

  const { emoji, variant, label } = severityConfig[severity];

  return (
    <Badge
      variant={variant}
      interactive={interactive}
      className={['severity-badge', className].filter(Boolean).join(' ')}
    >
      <span className="severity-emoji">{emoji}</span>
      {label}
      {count !== undefined && (
        <span className="severity-count">({count})</span>
      )}
    </Badge>
  );
}

// Badge with icon support
interface IconBadgeProps extends BadgeProps {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function IconBadge({
  icon,
  iconPosition = 'left',
  children,
  className = '',
  ...props
}: IconBadgeProps) {
  const combinedClassName = ['badge-with-icon', className].filter(Boolean).join(' ');

  return (
    <Badge className={combinedClassName} {...props}>
      {icon && iconPosition === 'left' && (
        <span className="badge-icon">{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className="badge-icon">{icon}</span>
      )}
    </Badge>
  );
}

// Badge group for displaying multiple badges
interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: boolean;
}

export function BadgeGroup({ 
  children, 
  className = '',
  maxWidth = false 
}: BadgeGroupProps) {
  const combinedClassName = [
    'badge-group',
    maxWidth && 'badge-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={combinedClassName}>
      {children}
    </div>
  );
}

// Status badge for different states
interface StatusBadgeProps {
  status: 'completed' | 'failed' | 'processing' | 'pending';
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const statusConfig = {
    completed: { variant: 'success' as const, label: 'Completed' },
    failed:    { variant: 'error' as const,   label: 'Failed'    },
    processing:{ variant: 'info' as const,    label: 'Processing'},
    pending:   { variant: 'default' as const, label: 'Pending'   },
  } as const;

  const { variant, label } = statusConfig[status];

  return (
    <Badge
      variant={variant}
      className={['status-badge', className].filter(Boolean).join(' ')}
    >
      {label}
    </Badge>
  );
}

// Notification badge with count
interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  className?: string;
}

export function NotificationBadge({ 
  count, 
  maxCount = 99, 
  className = '' 
}: NotificationBadgeProps) {
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <Badge
      variant="error"
      size="sm"
      className={['notification-badge', className].filter(Boolean).join(' ')}
    >
      {displayCount}
    </Badge>
  );
}

// Loading badge
interface LoadingBadgeProps {
  variant?: BadgeProps['variant'];
  size?: BadgeProps['size'];
  className?: string;
}

export function LoadingBadge({ 
  variant = 'default', 
  size = 'md', 
  className = '' 
}: LoadingBadgeProps) {
  return (
    <Badge
      variant={variant}
      size={size}
      className={['badge-loading', className].filter(Boolean).join(' ')}
    >
      Loading...
    </Badge>
  );
}