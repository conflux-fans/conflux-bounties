import request from 'supertest';
import express, { Express } from 'express';
import alertRoutes from '../../src/routes/alerts';
import { alertService } from '../../src/services/alertService';

jest.mock('../../src/services/alertService');

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '../../src/utils/logger';

describe('Alert Routes Integration Tests', () => {
  let app: Express;
  const mockAlertService = alertService as jest.Mocked<typeof alertService>;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/alerts', alertRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/alerts', () => {
    const validAlertData = {
      userAddress: '0x1234567890abcdef',
      asset: 'btc',
      targetPrice: 125000,
      condition: 'above',
    };

    it('should create alert successfully with valid data', async () => {
      const mockAlert = {
        id: '123',
        userAddress: validAlertData.userAddress,
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      mockAlertService.createAlert.mockResolvedValue(mockAlert as any);

      const response = await request(app)
        .post('/api/alerts')
        .send(validAlertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlert);
    });

    it('should return 400 when userAddress is missing', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          asset: 'BTC',
          targetPrice: 125000,
          condition: 'above',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 400 when asset is missing', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          userAddress: '0x1234',
          targetPrice: 125000,
          condition: 'above',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 400 when targetPrice is missing', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          userAddress: '0x1234',
          asset: 'BTC',
          condition: 'above',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when condition is missing', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          userAddress: '0x1234',
          asset: 'BTC',
          targetPrice: 125000,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid condition', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          ...validAlertData,
          condition: 'invalid',
        })
        .expect(400);

      expect(response.body.error).toBe('Condition must be "above" or "below"');
    });

    it('should return 400 for non-numeric targetPrice', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          ...validAlertData,
          targetPrice: 'not-a-number',
        })
        .expect(400);

      expect(response.body.error).toBe('Target price must be a positive number');
    });

    it('should return 400 for negative targetPrice', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          ...validAlertData,
          targetPrice: -100,
        })
        .expect(400);

      expect(response.body.error).toBe('Target price must be a positive number');
    });

    it('should return 400 for zero targetPrice', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send({
          ...validAlertData,
          targetPrice: 0,
        })
        .expect(400);

      expect(response.body.error).toBe('Target price must be a positive number');
    });

    it('should normalize asset to uppercase', async () => {
      const mockAlert = {
        id: '123',
        userAddress: validAlertData.userAddress,
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      mockAlertService.createAlert.mockResolvedValue(mockAlert as any);

      await request(app)
        .post('/api/alerts')
        .send(validAlertData)
        .expect(201);

      expect(mockAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({ asset: 'BTC' })
      );
    });

    it('should handle service errors', async () => {
      mockAlertService.createAlert.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/alerts')
        .send(validAlertData)
        .expect(500);

      expect(response.body.error).toBe('Failed to create alert');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should accept below condition', async () => {
      const mockAlert = {
        id: '123',
        userAddress: validAlertData.userAddress,
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'below',
        active: true,
        triggered: false,
        createdAt: Date.now(),
      };

      mockAlertService.createAlert.mockResolvedValue(mockAlert as any);

      await request(app)
        .post('/api/alerts')
        .send({ ...validAlertData, condition: 'below' })
        .expect(201);
    });
  });

  describe('GET /api/alerts/:userAddress', () => {
    it('should return alerts for user', async () => {
      const mockAlerts = [
        {
          id: '1',
          userAddress: '0x1234567890',
          asset: 'BTC',
          targetPrice: 125000,
          condition: 'above',
          active: true,
          triggered: false,
          createdAt: Date.now(),
        },
      ];

      mockAlertService.getUserAlerts.mockResolvedValue(mockAlerts as any);

      const response = await request(app)
        .get('/api/alerts/0x1234567890')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);
      expect(response.body.count).toBe(1);
    });

    it('should return empty array for user with no alerts', async () => {
      mockAlertService.getUserAlerts.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/alerts/0x1234567890')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return 400 for invalid address', async () => {
      const response = await request(app)
        .get('/api/alerts/short')
        .expect(400);

      expect(response.body.error).toBe('Invalid user address');
    });

    it('should handle service errors', async () => {
      mockAlertService.getUserAlerts.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/alerts/0x1234567890')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch alerts');
    });
  });

  describe('PUT /api/alerts/:alertId', () => {
    it('should update alert active status', async () => {
      const mockAlert = {
        id: 'alert123',
        active: false,
      };

      mockAlertService.updateAlert.mockResolvedValue(mockAlert as any);

      const response = await request(app)
        .put('/api/alerts/alert123')
        .send({ active: false })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should update target price', async () => {
      const mockAlert = {
        id: 'alert123',
        targetPrice: 130000,
      };

      mockAlertService.updateAlert.mockResolvedValue(mockAlert as any);

      await request(app)
        .put('/api/alerts/alert123')
        .send({ targetPrice: 130000 })
        .expect(200);
    });

    it('should return 400 with no fields', async () => {
      const response = await request(app)
        .put('/api/alerts/alert123')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('No fields to update');
    });

    it('should return 400 for invalid price', async () => {
      const response = await request(app)
        .put('/api/alerts/alert123')
        .send({ targetPrice: -100 })
        .expect(400);

      expect(response.body.error).toBe('Target price must be a positive number');
    });

    it('should return 404 when alert not found', async () => {
      mockAlertService.updateAlert.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/alerts/nonexistent')
        .send({ active: false })
        .expect(404);

      expect(response.body.error).toBe('Alert not found');
    });

    it('should handle service errors', async () => {
      mockAlertService.updateAlert.mockRejectedValue(new Error('DB error'));

      await request(app)
        .put('/api/alerts/alert123')
        .send({ active: false })
        .expect(500);
    });
  });

  describe('DELETE /api/alerts/:alertId', () => {
    it('should delete alert successfully', async () => {
      mockAlertService.deleteAlert.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/alerts/alert123')
        .expect(200);

      expect(response.body.message).toBe('Alert deleted successfully');
    });

    it('should return 404 when not found', async () => {
      mockAlertService.deleteAlert.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/alerts/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Alert not found');
    });

    it('should handle service errors', async () => {
      mockAlertService.deleteAlert.mockRejectedValue(new Error('DB error'));

      await request(app)
        .delete('/api/alerts/alert123')
        .expect(500);
    });
  });
});

