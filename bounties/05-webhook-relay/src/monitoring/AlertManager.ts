import { Logger } from './Logger';
import { HealthStatus } from './interfaces';
import { correlationIdManager } from './CorrelationId';

export interface AlertRule {
  id: string;
  name: string;
  condition: (status: HealthStatus) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMs: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertChannel {
  name: string;
  type: 'webhook' | 'email' | 'slack' | 'console';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger().child({ component: 'AlertManager' });
    this.setupDefaultRules();
    this.setupDefaultChannels();
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.logger.info('Alert rule removed', { ruleId });
  }

  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.name, channel);
    this.logger.info('Alert channel added', { name: channel.name, type: channel.type });
  }

  removeChannel(channelName: string): void {
    this.channels.delete(channelName);
    this.logger.info('Alert channel removed', { name: channelName });
  }

  async processHealthStatus(status: HealthStatus): Promise<void> {
    const correlationId = correlationIdManager.generateCorrelationId();
    
    await correlationIdManager.run({ correlationId }, async () => {
      for (const [ruleId, rule] of this.rules.entries()) {
        if (!rule.enabled) continue;

        try {
          const shouldAlert = rule.condition(status);
          const existingAlert = this.activeAlerts.get(ruleId);
          const lastAlertTime = this.lastAlertTime.get(ruleId) || 0;
          const now = Date.now();

          if (shouldAlert && !existingAlert) {
            // Check cooldown period
            if (now - lastAlertTime < rule.cooldownMs) {
              continue;
            }

            // Create new alert
            const alert: Alert = {
              id: `${ruleId}-${now}`,
              ruleId,
              name: rule.name,
              severity: rule.severity,
              message: this.generateAlertMessage(rule, status),
              timestamp: new Date(),
              resolved: false,
              metadata: {
                healthStatus: status,
                correlationId
              }
            };

            this.activeAlerts.set(ruleId, alert);
            this.lastAlertTime.set(ruleId, now);
            
            await this.sendAlert(alert);
            
          } else if (!shouldAlert && existingAlert && !existingAlert.resolved) {
            // Resolve existing alert
            existingAlert.resolved = true;
            existingAlert.resolvedAt = new Date();
            
            await this.sendResolutionNotification(existingAlert);
            this.activeAlerts.delete(ruleId);
          }
        } catch (error) {
          this.logger.error('Error processing alert rule', error as Error, { ruleId });
        }
      }
    });
  }

  private async sendAlert(alert: Alert): Promise<void> {
    this.logger.warn('Alert triggered', {
      alertId: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity,
      message: alert.message
    });

    const promises = Array.from(this.channels.values())
      .filter(channel => channel.enabled)
      .map(channel => this.sendToChannel(alert, channel));

    await Promise.allSettled(promises);
  }

  private async sendResolutionNotification(alert: Alert): Promise<void> {
    this.logger.info('Alert resolved', {
      alertId: alert.id,
      ruleId: alert.ruleId,
      resolvedAt: alert.resolvedAt
    });

    const resolutionMessage = `RESOLVED: ${alert.name} - Alert has been resolved`;
    const resolutionAlert: Alert = {
      ...alert,
      message: resolutionMessage,
      timestamp: new Date()
    };

    const promises = Array.from(this.channels.values())
      .filter(channel => channel.enabled)
      .map(channel => this.sendToChannel(resolutionAlert, channel));

    await Promise.allSettled(promises);
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'console':
          await this.sendToConsole(alert);
          break;
        case 'webhook':
          await this.sendToWebhook(alert, channel.config);
          break;
        case 'email':
          await this.sendToEmail(alert, channel.config);
          break;
        case 'slack':
          await this.sendToSlack(alert, channel.config);
          break;
        default:
          this.logger.warn('Unknown alert channel type', { type: channel.type });
      }
    } catch (error) {
      this.logger.error('Failed to send alert to channel', error as Error, {
        channelName: channel.name,
        channelType: channel.type,
        alertId: alert.id
      });
    }
  }

  private async sendToConsole(alert: Alert): Promise<void> {
    const severity = alert.severity.toUpperCase();
    const timestamp = alert.timestamp.toISOString();
    console.log(`[${severity}] ${timestamp} - ${alert.message}`);
  }

  private async sendToWebhook(alert: Alert, config: Record<string, any>): Promise<void> {
    const { url } = config;
    
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    // In a real implementation, you would use an HTTP client to send the payload
    this.logger.info('Webhook alert sent', { url, alertId: alert.id });
  }

  private async sendToEmail(alert: Alert, config: Record<string, any>): Promise<void> {
    const { to, from } = config;
    
    if (!to || !from) {
      throw new Error('Email configuration incomplete');
    }

    // In a real implementation, you would use an email service
    this.logger.info('Email alert sent', { to, from, alertId: alert.id });
  }

  private async sendToSlack(alert: Alert, config: Record<string, any>): Promise<void> {
    const { webhookUrl, channel } = config;
    
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    // In a real implementation, you would send to Slack
    this.logger.info('Slack alert sent', { channel, alertId: alert.id });
  }

  private generateAlertMessage(rule: AlertRule, status: HealthStatus): string {
    const failedChecks = Object.entries(status.checks)
      .filter(([, healthy]) => !healthy)
      .map(([name]) => name);

    return `${rule.name}: System status is ${status.status}. Failed checks: ${failedChecks.join(', ')}`;
  }

  private setupDefaultRules(): void {
    // Critical system failure
    this.addRule({
      id: 'critical-system-failure',
      name: 'Critical System Failure',
      condition: (status) => status.status === 'unhealthy',
      severity: 'critical',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // System degraded
    this.addRule({
      id: 'system-degraded',
      name: 'System Degraded',
      condition: (status) => status.status === 'degraded',
      severity: 'medium',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });

    // High memory usage
    this.addRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      condition: (status) => {
        if (!status.system?.memory) return false;
        return status.system.memory.usage > 90;
      },
      severity: 'high',
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      enabled: true
    });

    // Database connectivity issues
    this.addRule({
      id: 'database-connectivity',
      name: 'Database Connectivity Issues',
      condition: (status) => status.checks['database'] === false,
      severity: 'critical',
      cooldownMs: 2 * 60 * 1000, // 2 minutes
      enabled: true
    });
  }

  private setupDefaultChannels(): void {
    // Console channel (always enabled for development)
    this.addChannel({
      name: 'console',
      type: 'console',
      config: {},
      enabled: true
    });

    // Webhook channel (disabled by default)
    this.addChannel({
      name: 'webhook',
      type: 'webhook',
      config: {
        url: process.env['ALERT_WEBHOOK_URL'] || '',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      enabled: !!process.env['ALERT_WEBHOOK_URL']
    });
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getAlertChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }
}

export const alertManager = new AlertManager();