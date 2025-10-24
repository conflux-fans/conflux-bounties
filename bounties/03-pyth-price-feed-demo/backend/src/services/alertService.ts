import { pythService } from './pythService';
import { logger } from '../utils/logger';

export interface Alert {
  id: string;
  userAddress: string;
  asset: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

class AlertService {
  private alerts: Map<string, Alert>;
  private checkInterval: NodeJS.Timeout | null;

  constructor() {
    this.alerts = new Map();
    this.checkInterval = null;
  }

  async createAlert(params: {
    userAddress: string;
    asset: string;
    targetPrice: number;
    condition: 'above' | 'below';
  }): Promise<Alert> {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...params,
      active: true,
      triggered: false,
      createdAt: Date.now(),
    };

    this.alerts.set(alert.id, alert);
    logger.info(`Alert created: ${alert.id}`);

    return alert;
  }

  async getUserAlerts(userAddress: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      alert => alert.userAddress.toLowerCase() === userAddress.toLowerCase()
    );
  }

  async updateAlert(
    alertId: string,
    updates: { active?: boolean; targetPrice?: number }
  ): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    if (updates.active !== undefined) {
      alert.active = updates.active;
    }
    if (updates.targetPrice !== undefined) {
      alert.targetPrice = updates.targetPrice;
      alert.triggered = false;
    }

    this.alerts.set(alertId, alert);
    return alert;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    return this.alerts.delete(alertId);
  }

  async getAlertById(alertId: string): Promise<Alert | null> {
    return this.alerts.get(alertId) || null;
  }

  async clearAllAlerts(): Promise<void> {
    this.alerts.clear();
  }

  startAlertMonitoring() {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAlerts();
      } catch (error) {
        logger.error('Error checking alerts:', error);
      }
    }, 10000);
  }

  private async checkAlerts() {
    const activeAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.active && !alert.triggered
    );

    for (const alert of activeAlerts) {
      try {
        const price = await pythService.getPrice(alert.asset);
        
        if (!price) continue;

        const currentPrice = parseFloat(price.formattedPrice);
        const shouldTrigger = alert.condition === 'above'
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;

        if (shouldTrigger) {
          alert.triggered = true;
          alert.triggeredAt = Date.now();
          this.alerts.set(alert.id, alert);

          logger.info(`Alert triggered: ${alert.id}`);
          this.notifyUser(alert, currentPrice);
        }
      } catch (error) {
        logger.error(`Error checking alert ${alert.id}:`, error);
      }
    }
  }

  private notifyUser(alert: Alert, currentPrice: number) {
    logger.info(`Notification: ${alert.asset} is ${alert.condition} ${alert.targetPrice} (current: ${currentPrice})`);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const alertService = new AlertService();