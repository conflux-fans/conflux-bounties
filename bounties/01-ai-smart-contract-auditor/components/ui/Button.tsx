'use client';

import { forwardRef, ButtonHTMLAttributes, useState } from 'react';
import { Loader2 } from 'lucide-react';
import './button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 
    | 'default' 
    | 'primary' 
    | 'secondary' 
    | 'outline' 
    | 'ghost' 
    | 'destructive' 
    | 'gradient' 
    | 'glass' 
    | 'premium';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  fullWidth?: boolean;
  pulse?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      loading = false,
      icon,
      iconOnly = false,
      fullWidth = false,
      pulse = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const combinedClassName = [
      'button',
      `button-${variant}`,
      `button-${size}`,
      loading && 'button-loading',
      iconOnly && 'button-icon-only',
      fullWidth && 'button-full-width',
      pulse && 'button-pulse',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        {...props}
      >
        {variant === 'premium' && !disabled && !loading && (
          <div className="shimmer-container">
            <div className="shimmer" />
          </div>
        )}

        {loading ? (
          <Loader2 className="button-loader" />
        ) : (
          icon && <span className="button-icon">{icon}</span>
        )}

        {!iconOnly && (
          <span className="button-content">{children}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };

// Button Group component for grouping related buttons
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function ButtonGroup({ 
  children, 
  className = '',
  orientation = 'horizontal' 
}: ButtonGroupProps) {
  const combinedClassName = [
    'button-group',
    orientation === 'vertical' && 'button-group-vertical',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={combinedClassName}>
      {children}
    </div>
  );
}

// Icon Button - simplified version for icon-only buttons
interface IconButtonProps extends Omit<ButtonProps, 'children' | 'iconOnly'> {
  'aria-label': string; // Required for accessibility
  icon: React.ReactNode;
}

export function IconButton({ 
  icon, 
  className = '', 
  ...props 
}: IconButtonProps) {
  return (
    <Button
      {...props}
      icon={icon}
      iconOnly
      className={className}
    />
  );
}

// Loading Button - button that shows loading state
interface LoadingButtonProps extends Omit<ButtonProps, 'loading'> {
  isLoading: boolean;
  loadingText?: string;
}

export function LoadingButton({ 
  isLoading, 
  loadingText = 'Loading...', 
  children, 
  ...props 
}: LoadingButtonProps) {
  return (
    <Button {...props} loading={isLoading}>
      {isLoading ? loadingText : children}
    </Button>
  );
}

// Submit Button - button specifically for form submissions
interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  form?: string;
  submitting?: boolean;
  submittingText?: string;
}

export function SubmitButton({ 
  submitting = false, 
  submittingText = 'Submitting...', 
  children, 
  variant = 'primary',
  ...props 
}: SubmitButtonProps) {
  return (
    <Button
      {...props}
      type="submit"
      variant={variant}
      loading={submitting}
    >
      {submitting ? submittingText : children}
    </Button>
  );
}

// Link Button - button that looks like a button but acts like a link
interface LinkButtonProps extends Omit<ButtonProps, 'type'> {
  href: string;
  target?: string;
  rel?: string;
  external?: boolean;
}

export function LinkButton({ 
  href, 
  target, 
  rel, 
  external = false, 
  children, 
  className = '',
  ...props 
}: LinkButtonProps) {
  const linkProps = {
    href,
    target: external ? '_blank' : target,
    rel: external ? 'noopener noreferrer' : rel,
  };

  return (
    <a
      {...linkProps}
      className={[
        'button',
        `button-${props.variant || 'default'}`,
        `button-${props.size || 'md'}`,
        props.fullWidth && 'button-full-width',
        className,
      ].filter(Boolean).join(' ')}
      style={{ textDecoration: 'none' }}
    >
      {props.icon && <span className="button-icon">{props.icon}</span>}
      <span className="button-content">{children}</span>
    </a>
  );
}

// Copy Button - button that copies text to clipboard
interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  textToCopy: string;
  onCopySuccess?: () => void;
  onCopyError?: (error: Error) => void;
  successText?: string;
  errorText?: string;
}

export function CopyButton({ 
  textToCopy, 
  onCopySuccess, 
  onCopyError, 
  successText = 'Copied!', 
  errorText = 'Failed to copy', 
  children = 'Copy', 
  ...props 
}: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setStatus('success');
      onCopySuccess?.();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error');
      onCopyError?.(error as Error);
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'success': return successText;
      case 'error': return errorText;
      default: return children;
    }
  };

  const getVariant = () => {
    switch (status) {
      case 'success': return 'primary';
      case 'error': return 'destructive';
      default: return props.variant || 'outline';
    }
  };

  return (
    <Button
      {...props}
      variant={getVariant()}
      onClick={handleCopy}
      disabled={!navigator.clipboard || props.disabled}
    >
      {getButtonText()}
    </Button>
  );
}