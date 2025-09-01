// Webhook-related type definitions

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
}

export interface FormattedPayload {
  [key: string]: any;
}