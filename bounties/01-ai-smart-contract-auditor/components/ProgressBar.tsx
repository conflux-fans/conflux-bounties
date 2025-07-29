'use client';

import React from 'react';
import './progress-bar.css';

interface ProgressBarProps {
  progress: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  animated?: boolean;
  label?: string;
}

export default function ProgressBar({
  progress,
  className = '',
  size = 'md',
  variant = 'default',
  showPercentage = true,
  animated = true,
  label,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progress));

  const containerClasses = [
    'progress-bar',
    `progress-bar--${size}`,
    `progress-bar--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {(label || showPercentage) && (
        <div className="progress-bar__header">
          {label && <span className="progress-bar__label">{label}</span>}
          {showPercentage && (
            <span className="progress-bar__percentage">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}

      <div className="progress-bar__track">
        <div
          className={[
            'progress-bar__fill',
            animated && 'progress-bar__fill--animated',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${pct}%` }}
        >
          {animated && pct > 0 && pct < 100 && (
            <div className="progress-bar__stripe-overlay" />
          )}
          {pct > 0 && <div className="progress-bar__glow" />}
        </div>
      </div>

      {size === 'lg' && (
        <div className="progress-bar__milestones">
          <div className="progress-bar__dots">
            {[0, 25, 50, 75, 100].map(ms => (
              <span
                key={ms}
                className={[
                  'progress-bar__dot',
                  pct >= ms
                    ? 'progress-bar__dot--active'
                    : 'progress-bar__dot--inactive',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>
          <div className="progress-bar__labels">
            {[0, 25, 50, 75, 100].map(ms => (
              <span key={ms} className="progress-bar__milestone-label">
                {ms}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LoadingProgressBar({
  progress,
  message,
  className = '',
}: {
  progress: number;
  message?: string;
  className?: string;
}) {
  return (
    <div className={['loading-progress-bar', className].filter(Boolean).join(' ')}>
      {message && (
        <div className="loading-progress-bar__message">
          <span className="loading-progress-bar__spinner" />
          <span className="loading-progress-bar__text">{message}</span>
        </div>
      )}
      <ProgressBar
        progress={progress}
        variant="default"
        size="md"
        animated={true}
      />
    </div>
  );
}

export function AuditProgressBar({
  progress,
  stage,
  className = '',
}: {
  progress: number;
  stage?: string;
  className?: string;
}) {
  const pct = Math.min(Math.max(progress, 0), 100);
  const variant =
    pct === 100 ? 'success' : pct >= 75 ? 'warning' : 'default';

  return (
    <div className={['audit-progress-bar', className].filter(Boolean).join(' ')}>
      <div className="audit-progress-bar__header">
        <div className="audit-progress-bar__info">
          <span className="audit-progress-bar__icon" />
          <div>
            <h3 className="audit-progress-bar__title">Security Analysis</h3>
            {stage && (
              <p className="audit-progress-bar__stage">
                {stage.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        </div>
        <div className="audit-progress-bar__percent-label">
          {Math.round(pct)}%
        </div>
      </div>
      <ProgressBar
        progress={pct}
        variant={variant}
        size="lg"
        animated={pct < 100}
        showPercentage={false}
      />
    </div>
  );
}

export function MultiStepProgressBar({
  currentStep,
  steps,
  className = '',
}: {
  currentStep: number;
  steps: string[];
  className?: string;
}) {
  return (
    <div className={['multi-step-progress-bar', className].filter(Boolean).join(' ')}>
      <div className="multi-step-progress-bar__steps">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <React.Fragment key={idx}>
              <div className="multi-step-progress-bar__step">
                <div
                  className={[
                    'multi-step-progress-bar__circle',
                    isDone && 'multi-step-progress-bar__circle--done',
                    isActive && 'multi-step-progress-bar__circle--active',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {isDone ? <span className="multi-step-progress-bar__check" /> : idx + 1}
                </div>
                <span className="multi-step-progress-bar__label">{step}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={[
                    'multi-step-progress-bar__connector',
                    idx < currentStep
                      ? 'multi-step-progress-bar__connector--done'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
