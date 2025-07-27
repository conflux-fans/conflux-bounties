'use client';

import { Toaster } from 'react-hot-toast';
import './toast.css';

export function Toast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'toast toast--default',
        duration: 4000,
        success: {
          className: 'toast toast--success',
          iconTheme: {
            primary: '#10b981',
            secondary: '#ffffff',
          },
        },
        error: {
          className: 'toast toast--error',
          iconTheme: {
            primary: '#ef4444',
            secondary: '#ffffff',
          },
        },
        loading: {
          className: 'toast toast--loading',
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}
