import { alertService, Alert } from '../../../src/services/alertService';
import { pythService } from '../../../src/services/pythService';
import { logger } from '../../../src/utils/logger';

jest.mock('../../../src/services/pythService', () => ({
  pythService: {
    getPrice: jest.fn(),
    getAllPrices: jest.fn(),
    getCachedPrice: jest.fn(),
    getPriceUpdateData: jest.fn(),
    getLastUpdateTime: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedPythService = pythService as jest.Mocked<typeof pythService>;

describe('AlertService Unit Tests', () => {
  beforeEach(async () => {
    await alertService.clearAllAlerts();
    jest.clearAllMocks();
    
    mockedPythService.getPrice.mockResolvedValue({
      symbol: 'BTC',
      price: '12345678000000',
      confidence: '95000000',
      expo: -8,
      publishTime: Date.now(),
      formattedPrice: '123456.78',
    });
  });

  afterAll(() => {
    alertService.stopMonitoring();
  });

  describe('createAlert', () => {
    it('should create alert successfully', async () => {
      const alertData = {
        userAddress: '0x1234567890abcdef',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above' as const,
      };

      const alert = await alertService.createAlert(alertData);

      expect(alert).toBeDefined();
      expect(alert.id).toBeDefined();
      expect(alert.userAddress).toBe(alertData.userAddress);
      expect(alert.asset).toBe('BTC');
      expect(alert.targetPrice).toBe(125000);
      expect(alert.condition).toBe('above');
      expect(alert.active).toBe(true);
      expect(alert.triggered).toBe(false);
      expect(alert.createdAt).toBeGreaterThan(0);
    });

    it('should generate unique IDs for each alert', async () => {
      const alert1 = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const alert2 = await alertService.createAlert({
        userAddress: '0x5678',
        asset: 'ETH',
        targetPrice: 5000,
        condition: 'below',
      });

      expect(alert1.id).not.toBe(alert2.id);
    });
  });

  describe('getUserAlerts', () => {
    it('should return empty array for user with no alerts', async () => {
      const alerts = await alertService.getUserAlerts('0xnonexistent');
      expect(alerts).toEqual([]);
    });

    it('should return all alerts for specific user', async () => {
      const userAddress = '0x1234567890';

      await alertService.createAlert({
        userAddress,
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      await alertService.createAlert({
        userAddress,
        asset: 'ETH',
        targetPrice: 5000,
        condition: 'below',
      });

      const alerts = await alertService.getUserAlerts(userAddress);
      expect(alerts).toHaveLength(2);
    });

    it('should be case-insensitive for user address', async () => {
      await alertService.createAlert({
        userAddress: '0xABCDEF',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const alertsLower = await alertService.getUserAlerts('0xabcdef');
      expect(alertsLower).toHaveLength(1);
    });
  });

  describe('updateAlert', () => {
    it('should update alert active status', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const updated = await alertService.updateAlert(alert.id, { active: false });
      expect(updated!.active).toBe(false);
    });

    it('should update alert target price', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const updated = await alertService.updateAlert(alert.id, { targetPrice: 130000 });
      expect(updated!.targetPrice).toBe(130000);
    });

    it('should reset triggered status when target price changes', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      alert.triggered = true;
      const updated = await alertService.updateAlert(alert.id, { targetPrice: 130000 });
      expect(updated!.triggered).toBe(false);
    });

    it('should return null for non-existent alert', async () => {
      const result = await alertService.updateAlert('non-existent-id', { active: false });
      expect(result).toBeNull();
    });
  });

  describe('deleteAlert', () => {
    it('should delete alert successfully', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const result = await alertService.deleteAlert(alert.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent alert', async () => {
      const result = await alertService.deleteAlert('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getAlertById', () => {
    it('should return alert by ID', async () => {
      const created = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      const found = await alertService.getAlertById(created.id);
      expect(found).toEqual(created);
    });

    it('should return null for non-existent ID', async () => {
      const found = await alertService.getAlertById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('clearAllAlerts', () => {
    it('should clear all alerts', async () => {
      await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      });

      await alertService.clearAllAlerts();

      const alerts = await alertService.getUserAlerts('0x1234');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Alert Monitoring - checkAlerts method', () => {
    it('should trigger alert when price goes above target', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      mockedPythService.getPrice.mockResolvedValue({
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '123456.78',
      });

      await (alertService as any).checkAlerts();

      const updatedAlert = await alertService.getAlertById(alert.id);
      expect(updatedAlert!.triggered).toBe(true);
      expect(updatedAlert!.triggeredAt).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Alert triggered'));
    });

    it('should trigger alert when price goes below target', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'ETH',
        targetPrice: 5000, 
        condition: 'below',
      });

      mockedPythService.getPrice.mockResolvedValue({
        symbol: 'ETH',
        price: '450000000000',
        confidence: '85000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '4500.00',
      });

      await (alertService as any).checkAlerts();

      const updatedAlert = await alertService.getAlertById(alert.id);
      expect(updatedAlert!.triggered).toBe(true);
      expect(updatedAlert!.triggeredAt).toBeDefined();
    });

    it('should not trigger alert when condition not met', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 150000,
        condition: 'above',
      });

      mockedPythService.getPrice.mockResolvedValue({
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '123456.78',
      });

      await (alertService as any).checkAlerts();

      const updatedAlert = await alertService.getAlertById(alert.id);
      expect(updatedAlert!.triggered).toBe(false);
      expect(updatedAlert!.triggeredAt).toBeUndefined();
    });

    it('should skip inactive alerts', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      await alertService.updateAlert(alert.id, { active: false });

      await (alertService as any).checkAlerts();

      const updatedAlert = await alertService.getAlertById(alert.id);
      expect(updatedAlert!.triggered).toBe(false);
    });

    it('should skip already triggered alerts', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      await (alertService as any).checkAlerts();

      jest.clearAllMocks();

      await (alertService as any).checkAlerts();

      expect(mockedPythService.getPrice).not.toHaveBeenCalled();
    });

    it('should handle null price from pythService', async () => {
      await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      mockedPythService.getPrice.mockResolvedValue(null);

      await expect((alertService as any).checkAlerts()).resolves.not.toThrow();
    });

    it('should handle errors when checking individual alert', async () => {
      await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      mockedPythService.getPrice.mockRejectedValue(new Error('Price fetch error'));

      await (alertService as any).checkAlerts();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking alert'),
        expect.any(Error)
      );
    });

    it('should check multiple alerts', async () => {
      await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      await alertService.createAlert({
        userAddress: '0x5678',
        asset: 'ETH',
        targetPrice: 5000,
        condition: 'below',
      });

      mockedPythService.getPrice.mockResolvedValueOnce({
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '123456.78',
      }).mockResolvedValueOnce({
        symbol: 'ETH',
        price: '450000000000',
        confidence: '85000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '4500.00',
      });

      await (alertService as any).checkAlerts();

      expect(mockedPythService.getPrice).toHaveBeenCalledTimes(2);
    });

    it('should call notifyUser when alert triggers', async () => {
      const alert = await alertService.createAlert({
        userAddress: '0x1234',
        asset: 'BTC',
        targetPrice: 120000,
        condition: 'above',
      });

      mockedPythService.getPrice.mockResolvedValue({
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: Date.now(),
        formattedPrice: '123456.78',
      });

      await (alertService as any).checkAlerts();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Notification')
      );
    });
  });

  describe('startAlertMonitoring and stopMonitoring', () => {
    it('should start monitoring without errors', () => {
      expect(() => {
        alertService.startAlertMonitoring();
      }).not.toThrow();
      alertService.stopMonitoring();
    });

    it('should stop monitoring without errors', () => {
      alertService.startAlertMonitoring();
      
      expect(() => {
        alertService.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle multiple start calls gracefully', () => {
      alertService.startAlertMonitoring();
      alertService.startAlertMonitoring();
      
      expect(() => {
        alertService.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle stop without start', () => {
      expect(() => {
        alertService.stopMonitoring();
      }).not.toThrow();
    });
  });
});