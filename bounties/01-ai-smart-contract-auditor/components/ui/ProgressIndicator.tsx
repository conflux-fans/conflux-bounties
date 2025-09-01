'use client';

import { motion } from 'framer-motion';
import { Check, Clock, AlertCircle } from 'lucide-react';
import './progress-indicator.css';

interface ProgressStep {
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  description?: string;
}

interface StepperProps {
  steps: ProgressStep[];
  className?: string;
}

export function Stepper({ steps, className = '' }: StepperProps) {
  return (
    <div className={`stepper ${className}`}>
      {steps.map((step, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="stepper__item"
        >
          <div className="stepper__icon">
            <StepIcon status={step.status} />
          </div>
          <div className="stepper__content">
            <p
              className={[
                'stepper__label',
                `stepper__label--${step.status}`,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step.label}
            </p>
            {step.description && (
              <p className="stepper__description">{step.description}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function StepIcon({ status }: { status: ProgressStep['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="step-icon step-icon--completed"
        >
          <Check className="step-icon__icon" />
        </motion.div>
      );
    case 'current':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="step-icon step-icon--current"
        >
          <Clock className="step-icon__icon" />
        </motion.div>
      );
    case 'error':
      return (
        <div className="step-icon step-icon--error">
          <AlertCircle className="step-icon__icon" />
        </div>
      );
    default:
      return <div className="step-icon step-icon--pending" />;
  }
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  className = '',
  children,
}: CircularProgressProps) {
  const normalized = Math.min(Math.max(value, 0), max);
  const pct = (normalized / max) * 100;
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className={`circular-progress ${className}`}>
      <svg
        width={size}
        height={size}
        className="circular-progress__svg"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="circular-progress__bg"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="circular-progress__fg"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          strokeLinecap="round"
        />
      </svg>
      {children && (
        <div className="circular-progress__content">{children}</div>
      )}
    </div>
  );
}

interface LinearProgressProps {
  value: number;
  max?: number;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  animated?: boolean;
}

export function LinearProgress({
  value,
  max = 100,
  className = '',
  variant = 'default',
  animated = true,
}: LinearProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const barClasses = [
    'linear-progress__bar',
    `linear-progress__bar--${variant}`,
    animated && 'linear-progress__bar--animated',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`linear-progress ${className}`}>
      <motion.div
        className={barClasses}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}
