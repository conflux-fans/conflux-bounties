'use client';

import { forwardRef, HTMLAttributes } from 'react';
import './card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost' | 'glass' | 'premium';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  loading?: boolean;
  status?: 'error' | 'success' | 'warning';
  fullHeight?: boolean;
  sticky?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      loading = false,
      status,
      fullHeight = false,
      sticky = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const combinedClassName = [
      'card',
      `card-${variant}`,
      `card-padding-${padding}`,
      interactive && 'card-interactive',
      loading && 'card-loading',
      status && `card-${status}`,
      fullHeight && 'card-full-height',
      sticky && 'card-sticky',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {loading && <div className="card-loading-content">{children}</div>}
        {!loading && children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div 
      ref={ref} 
      className={['card-header', className].filter(Boolean).join(' ')} 
      {...props} 
    />
  )
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', className = '', ...props }, ref) => (
    <Component 
      ref={ref} 
      className={['card-title', className].filter(Boolean).join(' ')} 
      {...props} 
    />
  )
);

CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p 
      ref={ref} 
      className={['card-description', className].filter(Boolean).join(' ')} 
      {...props} 
    />
  )
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', padding, ...props }, ref) => {
    const paddingClass = padding ? `card-padding-${padding}` : '';
    return (
      <div
        ref={ref}
        className={['card-content', paddingClass, className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  }
);

CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div 
      ref={ref} 
      className={['card-footer', className].filter(Boolean).join(' ')} 
      {...props} 
    />
  )
);

CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};

// Additional utility components for common card patterns

// Card with image
interface ImageCardProps extends CardProps {
  imageSrc: string;
  imageAlt: string;
  imageHeight?: number;
}

export const ImageCard = forwardRef<HTMLDivElement, ImageCardProps>(
  ({ imageSrc, imageAlt, imageHeight = 200, children, className = '', ...props }, ref) => (
    <Card 
      ref={ref} 
      className={['card-with-image', className].filter(Boolean).join(' ')} 
      padding="none" 
      {...props}
    >
      <img 
        src={imageSrc} 
        alt={imageAlt} 
        className="card-image" 
        style={{ height: imageHeight }}
      />
      <div className="card-padding-md">
        {children}
      </div>
    </Card>
  )
);

ImageCard.displayName = 'ImageCard';

// Card with badge
interface BadgeCardProps extends CardProps {
  badge: React.ReactNode;
}

export const BadgeCard = forwardRef<HTMLDivElement, BadgeCardProps>(
  ({ badge, children, className = '', ...props }, ref) => (
    <Card 
      ref={ref} 
      className={['card-with-badge', className].filter(Boolean).join(' ')} 
      {...props}
    >
      <div className="card-badge">{badge}</div>
      {children}
    </Card>
  )
);

BadgeCard.displayName = 'BadgeCard';

// Card group components
interface CardGridProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}

export function CardGrid({ children, className = '', minWidth = 300 }: CardGridProps) {
  return (
    <div 
      className={['card-grid', className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

interface CardStackProps {
  children: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
}

export function CardStack({ children, className = '', gap = 'sm' }: CardStackProps) {
  const gapClass = `gap-${gap}`;
  return (
    <div className={['card-stack', gapClass, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

interface CardRowProps {
  children: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
}

export function CardRow({ children, className = '', gap = 'sm' }: CardRowProps) {
  const gapClass = `gap-${gap}`;
  return (
    <div className={['card-row', gapClass, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

// Specialized card types
interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  variant?: CardProps['variant'];
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  trend, 
  icon, 
  variant = 'default' 
}: StatsCardProps) {
  return (
    <Card variant={variant}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle as="h4">{title}</CardTitle>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary mb-2">{value}</div>
        {description && (
          <CardDescription>
            {trend && (
              <span className={`inline-flex items-center text-sm ${
                trend === 'up' ? 'text-green-500' : 
                trend === 'down' ? 'text-red-500' : 
                'text-gray-500'
              }`}>
                {trend === 'up' && '↗'} 
                {trend === 'down' && '↘'} 
                {trend === 'neutral' && '→'} 
              </span>
            )}
            {description}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
}

// Feature card for highlighting features or benefits
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: CardProps['variant'];
}

export function FeatureCard({ 
  icon, 
  title, 
  description, 
  action, 
  variant = 'outline' 
}: FeatureCardProps) {
  return (
    <Card variant={variant} interactive>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="text-primary text-2xl">{icon}</div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
      {action && (
        <CardFooter>
          {action}
        </CardFooter>
      )}
    </Card>
  );
}