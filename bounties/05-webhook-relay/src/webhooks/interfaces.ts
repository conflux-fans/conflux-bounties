// Webhook delivery interfaces
import type { WebhookDelivery, WebhookConfig, DeliveryResult, ValidationResult } from '../types';

export interface IWebhookConfigProvider {
  getWebhookConfig(webhookId: string): Promise<WebhookConfig | null>;
  loadWebhookConfigs(): Promise<void>;
  refreshConfigs(): Promise<void>;
}

export interface IWebhookSender {
  sendWebhook(delivery: WebhookDelivery, webhookConfig?: WebhookConfig): Promise<DeliveryResult>;
  validateWebhookConfig(config: WebhookConfig): ValidationResult;
}

export interface IHttpClient {
  post(url: string, data: any, headers: Record<string, string>, timeout: number): Promise<DeliveryResult>;
  cleanup?(): void;
}

export interface IDeliveryTracker {
  trackDelivery(delivery: WebhookDelivery, result: DeliveryResult): Promise<void>;
  getDeliveryStats(webhookId: string): Promise<DeliveryStats>;
}

export interface DeliveryStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
}