'use client';

import { motion } from 'framer-motion';
import './spinners.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'gray';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = 'primary',
  className = '',
}: LoadingSpinnerProps) {
  const sizes = {
    sm: 'spinner-sm',
    md: 'spinner-md',
    lg: 'spinner-lg',
  };

  const colors = {
    primary: 'spinner-color-primary',
    secondary: 'spinner-color-secondary',
    gray: 'spinner-color-gray',
  };

  const classes = [
    sizes[size],
    colors[color],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={classes}
    >
      <svg className="spinner-svg" viewBox="0 0 24 24" fill="none">
        <circle
          className="spinner-circle"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="spinner-path"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
        />
      </svg>
    </motion.div>
  );
}

interface PulsingDotsProps {
  className?: string;
}

export function PulsingDots({ className = '' }: PulsingDotsProps) {
  const containerClasses = ['pulsing-dots', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
          className="pulsing-dot"
        />
      ))}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  animated?: boolean;
}

export function Skeleton({ className = '', animated = true }: SkeletonProps) {
  const classes = [
    'skeleton',
    animated && 'skeleton-animated',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} />;
}
