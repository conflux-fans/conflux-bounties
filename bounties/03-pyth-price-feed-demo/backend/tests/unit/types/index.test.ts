import type {
  PriceData,
  Alert,
  WebSocketMessage,
  ApiResponse,
} from '../../../src/types/index';

describe('TypeScript Types', () => {
  describe('PriceData Type', () => {
    it('should accept valid PriceData object', () => {
      const priceData: PriceData = {
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: 1728456789,
        formattedPrice: '123456.78',
      };

      expect(priceData.symbol).toBe('BTC');
      expect(priceData.expo).toBe(-8);
      expect(priceData.formattedPrice).toBe('123456.78');
    });

    it('should have correct property types', () => {
      const priceData: PriceData = {
        symbol: 'ETH',
        price: '453295000000',
        confidence: '85000000',
        expo: -8,
        publishTime: 1728456790,
        formattedPrice: '4532.95',
      };

      expect(typeof priceData.symbol).toBe('string');
      expect(typeof priceData.price).toBe('string');
      expect(typeof priceData.expo).toBe('number');
      expect(typeof priceData.publishTime).toBe('number');
    });
  });

  describe('Alert Type', () => {
    it('should accept valid Alert object', () => {
      const alert: Alert = {
        id: 'alert-123',
        userAddress: '0x1234567890abcdef',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      expect(alert.id).toBe('alert-123');
      expect(alert.condition).toBe('above');
      expect(alert.active).toBe(true);
    });

    it('should support both above and below conditions', () => {
      const aboveAlert: Alert = {
        id: '1',
        userAddress: '0x123',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      const belowAlert: Alert = {
        id: '2',
        userAddress: '0x456',
        asset: 'ETH',
        targetPrice: 4000,
        condition: 'below',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      expect(aboveAlert.condition).toBe('above');
      expect(belowAlert.condition).toBe('below');
    });

    it('should support optional triggeredAt field', () => {
      const triggeredAlert: Alert = {
        id: '3',
        userAddress: '0x789',
        asset: 'CFX',
        targetPrice: 1,
        condition: 'above',
        active: false,
        triggered: true,
        createdAt: Date.now(),
        triggeredAt: Date.now(),
      };

      expect(triggeredAlert.triggeredAt).toBeDefined();
      expect(typeof triggeredAlert.triggeredAt).toBe('number');
    });
  });

  describe('WebSocketMessage Type', () => {
    it('should accept price_update message', () => {
      const message: WebSocketMessage = {
        type: 'price_update',
        data: { BTC: '123456.78' },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('price_update');
      expect(message.data).toBeDefined();
    });

    it('should accept liquidation_alert message', () => {
      const message: WebSocketMessage = {
        type: 'liquidation_alert',
        data: { position: 'test' },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('liquidation_alert');
    });

    it('should accept alert_triggered message', () => {
      const message: WebSocketMessage = {
        type: 'alert_triggered',
        data: { alertId: '123' },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('alert_triggered');
    });
  });

  describe('ApiResponse Type', () => {
    it('should accept successful response', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'Test data',
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe('Test data');
    });

    it('should accept error response', () => {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Something went wrong',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });

    it('should support metadata', () => {
      const response: ApiResponse<string[]> = {
        success: true,
        data: ['item1', 'item2'],
        metadata: {
          count: 2,
          page: 1,
        },
      };

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.count).toBe(2);
    });

    it('should work with different data types', () => {
      const stringResponse: ApiResponse<string> = {
        success: true,
        data: 'text',
      };

      const numberResponse: ApiResponse<number> = {
        success: true,
        data: 42,
      };

      const objectResponse: ApiResponse<{ key: string }> = {
        success: true,
        data: { key: 'value' },
      };

      expect(stringResponse.data).toBe('text');
      expect(numberResponse.data).toBe(42);
      expect(objectResponse.data.key).toBe('value');
    });
  });

  describe('Type Safety', () => {
    it('should enforce type constraints', () => {
      const alert: Alert = {
        id: 'test',
        userAddress: '0xabc',
        asset: 'BTC',
        targetPrice: 100000,
        condition: 'above', // Must be 'above' or 'below'
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      expect(alert.condition).toMatch(/^(above|below)$/);
    });
  });
});