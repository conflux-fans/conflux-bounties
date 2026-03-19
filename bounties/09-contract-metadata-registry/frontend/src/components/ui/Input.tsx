'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx('input-base', error && 'border-[rgb(var(--color-danger))] focus:ring-[rgb(var(--color-danger))]', className)}
          {...props}
        />
        {hint && !error && <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>}
        {error && <p className="mt-1 text-xs text-[rgb(var(--color-danger))]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={clsx('input-base min-h-[100px] resize-y', error && 'border-[rgb(var(--color-danger))]', className)}
          {...props}
        />
        {hint && !error && <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>}
        {error && <p className="mt-1 text-xs text-[rgb(var(--color-danger))]">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
