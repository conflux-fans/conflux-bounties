// Common types and utilities

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export interface WebhookConfig {
  id: string;
  url: string;
  format: WebhookFormat;
  headers: Record<string, string>;
  timeout: number;
  retryAttempts: number;
}

export type DeliveryStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type WebhookFormat = 'zapier' | 'make' | 'n8n' | 'generic';
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';