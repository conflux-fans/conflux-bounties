// Test core type definitions
import {
    BlockchainEvent,
    WebhookConfig,
    WebhookDelivery,
    DeliveryStatus,
    WebhookFormat
} from '../index';

describe('Core Types', () => {
    describe('BlockchainEvent', () => {
        it('should have all required properties', () => {
            const event: BlockchainEvent = {
                contractAddress: '0x1234567890123456789012345678901234567890',
                eventName: 'Transfer',
                blockNumber: 12345,
                transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                logIndex: 0,
                args: { from: '0x123', to: '0x456', value: '1000' },
                timestamp: new Date()
            };

            expect(event.contractAddress).toBeDefined();
            expect(event.eventName).toBeDefined();
            expect(event.blockNumber).toBeDefined();
            expect(event.transactionHash).toBeDefined();
            expect(event.logIndex).toBeDefined();
            expect(event.args).toBeDefined();
            expect(event.timestamp).toBeDefined();
        });
    });

    describe('WebhookConfig', () => {
        it('should have all required properties', () => {
            const config: WebhookConfig = {
                id: 'webhook-1',
                url: 'https://example.com/webhook',
                format: 'generic',
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
                retryAttempts: 3
            };

            expect(config.id).toBeDefined();
            expect(config.url).toBeDefined();
            expect(config.format).toBeDefined();
            expect(config.headers).toBeDefined();
            expect(config.timeout).toBeDefined();
            expect(config.retryAttempts).toBeDefined();
        });
    });

    describe('WebhookDelivery', () => {
        it('should have all required properties', () => {
            const delivery: WebhookDelivery = {
                id: 'delivery-1',
                subscriptionId: 'sub-1',
                webhookId: 'webhook-1',
                event: {
                    contractAddress: '0x1234567890123456789012345678901234567890',
                    eventName: 'Transfer',
                    blockNumber: 12345,
                    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                    logIndex: 0,
                    args: { from: '0x123', to: '0x456', value: '1000' },
                    timestamp: new Date()
                },
                payload: { test: 'data' },
                attempts: 0,
                maxAttempts: 3,
                status: 'pending'
            };

            expect(delivery.id).toBeDefined();
            expect(delivery.subscriptionId).toBeDefined();
            expect(delivery.webhookId).toBeDefined();
            expect(delivery.event).toBeDefined();
            expect(delivery.payload).toBeDefined();
            expect(delivery.attempts).toBeDefined();
            expect(delivery.maxAttempts).toBeDefined();
            expect(delivery.status).toBeDefined();
        });
    });

    describe('Type Guards', () => {
        it('should validate DeliveryStatus values', () => {
            const validStatuses: DeliveryStatus[] = ['pending', 'processing', 'completed', 'failed'];
            validStatuses.forEach(status => {
                expect(['pending', 'processing', 'completed', 'failed']).toContain(status);
            });
        });

        it('should validate WebhookFormat values', () => {
            const validFormats: WebhookFormat[] = ['zapier', 'make', 'n8n', 'generic'];
            validFormats.forEach(format => {
                expect(['zapier', 'make', 'n8n', 'generic']).toContain(format);
            });
        });
    });
});