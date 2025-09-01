import type { IDeliveryTracker, DeliveryStats } from './interfaces';
import type { WebhookDelivery, DeliveryResult } from '../types';

export class DeliveryTracker implements IDeliveryTracker {
  private deliveryHistory: Map<string, DeliveryRecord[]> = new Map();

  async trackDelivery(delivery: WebhookDelivery, result: DeliveryResult): Promise<void> {
    const record: DeliveryRecord = {
      deliveryId: delivery.id,
      webhookId: delivery.webhookId,
      timestamp: new Date(),
      success: result.success,
      responseTime: result.responseTime,
      attempt: delivery.attempts,
    };

    if (result.statusCode !== undefined) {
      record.statusCode = result.statusCode;
    }

    if (result.error !== undefined) {
      record.error = result.error;
    }

    const webhookHistory = this.deliveryHistory.get(delivery.webhookId) || [];
    webhookHistory.push(record);
    
    // Keep only the last 1000 records per webhook to prevent memory issues
    if (webhookHistory.length > 1000) {
      webhookHistory.shift();
    }
    
    this.deliveryHistory.set(delivery.webhookId, webhookHistory);
  }

  async getDeliveryStats(webhookId: string): Promise<DeliveryStats> {
    const history = this.deliveryHistory.get(webhookId) || [];
    
    if (history.length === 0) {
      return {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
      };
    }

    const successfulDeliveries = history.filter(record => record.success).length;
    const failedDeliveries = history.length - successfulDeliveries;
    const totalResponseTime = history.reduce((sum, record) => sum + record.responseTime, 0);
    const averageResponseTime = totalResponseTime / history.length;

    return {
      totalDeliveries: history.length,
      successfulDeliveries,
      failedDeliveries,
      averageResponseTime: Math.round(averageResponseTime),
    };
  }

  // Additional method to get recent delivery history for debugging
  getRecentDeliveries(webhookId: string, limit: number = 10): DeliveryRecord[] {
    const history = this.deliveryHistory.get(webhookId) || [];
    return history.slice(-limit);
  }

  // Method to clear old delivery history
  clearHistory(webhookId?: string): void {
    if (webhookId) {
      this.deliveryHistory.delete(webhookId);
    } else {
      this.deliveryHistory.clear();
    }
  }
}

interface DeliveryRecord {
  deliveryId: string;
  webhookId: string;
  timestamp: Date;
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  attempt: number;
}