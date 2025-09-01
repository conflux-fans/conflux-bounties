import * as FactoryIndex from '../index';
import { EventFactory } from '../EventFactory';
import { WebhookFactory } from '../WebhookFactory';
import { ConfigFactory } from '../ConfigFactory';
import { DeliveryFactory } from '../DeliveryFactory';
import { ContractFactory } from '../ContractFactory';

describe('Factory Index', () => {
    describe('exports', () => {
        it('should export EventFactory', () => {
            expect(FactoryIndex.EventFactory).toBeDefined();
            expect(FactoryIndex.EventFactory).toBe(EventFactory);
        });

        it('should export WebhookFactory', () => {
            expect(FactoryIndex.WebhookFactory).toBeDefined();
            expect(FactoryIndex.WebhookFactory).toBe(WebhookFactory);
        });

        it('should export ConfigFactory', () => {
            expect(FactoryIndex.ConfigFactory).toBeDefined();
            expect(FactoryIndex.ConfigFactory).toBe(ConfigFactory);
        });

        it('should export DeliveryFactory', () => {
            expect(FactoryIndex.DeliveryFactory).toBeDefined();
            expect(FactoryIndex.DeliveryFactory).toBe(DeliveryFactory);
        });

        it('should export ContractFactory', () => {
            expect(FactoryIndex.ContractFactory).toBeDefined();
            expect(FactoryIndex.ContractFactory).toBe(ContractFactory);
        });
    });

    describe('factory functionality', () => {
        it('should be able to create objects using exported factories', () => {
            const event = FactoryIndex.EventFactory.createBlockchainEvent();
            const webhook = FactoryIndex.WebhookFactory.createWebhookConfig();
            const config = FactoryIndex.ConfigFactory.createSystemConfig();
            const delivery = FactoryIndex.DeliveryFactory.createWebhookDelivery();
            const contractABI = FactoryIndex.ContractFactory.getTestTokenABI();
            const contractAddress = FactoryIndex.ContractFactory.generateTestAddress();

            expect(event).toBeDefined();
            expect(webhook).toBeDefined();
            expect(config).toBeDefined();
            expect(delivery).toBeDefined();
            expect(contractABI).toBeDefined();
            expect(contractAddress).toBeDefined();
        });

        it('should maintain factory independence', () => {
            const event1 = FactoryIndex.EventFactory.createBlockchainEvent();
            const event2 = FactoryIndex.EventFactory.createBlockchainEvent();

            // Events should be different instances
            expect(event1).not.toBe(event2);

            // But should have the same structure
            expect(typeof event1).toBe(typeof event2);
        });

        it('should allow overrides in factory methods', () => {
            const customEvent = FactoryIndex.EventFactory.createBlockchainEvent({
                eventName: 'CustomEvent',
                blockNumber: 99999
            });

            expect(customEvent.eventName).toBe('CustomEvent');
            expect(customEvent.blockNumber).toBe(99999);
        });

        it('should create different types of objects', () => {
            const event = FactoryIndex.EventFactory.createBlockchainEvent();
            const webhook = FactoryIndex.WebhookFactory.createWebhookConfig();

            expect(event).toHaveProperty('contractAddress');
            expect(event).toHaveProperty('eventName');
            expect(webhook).toHaveProperty('url');
            expect(webhook).toHaveProperty('format');
        });

        it('should provide contract utilities', () => {
            const abi = FactoryIndex.ContractFactory.getTestTokenABI();
            const address1 = FactoryIndex.ContractFactory.generateTestAddress(1);
            const address2 = FactoryIndex.ContractFactory.generateTestAddress(2);

            expect(Array.isArray(abi)).toBe(true);
            expect(abi.length).toBeGreaterThan(0);
            expect(address1).toMatch(/^0x[0-9a-f]{40}$/);
            expect(address2).toMatch(/^0x[0-9a-f]{40}$/);
            expect(address1).not.toBe(address2);
        });
    });
});