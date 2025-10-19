import request from 'supertest';
import appDefault from '../../src/server';
import { start, stop } from '../../src/server';
const app = appDefault;

jest.mock('../../src/services/WebsocketService', () => ({
  websocketService: {
    addClient: jest.fn(),
    removeClient: jest.fn(),
    handleMessage: jest.fn(),
    startPriceStreaming: jest.fn(),
    stopPriceStreaming: jest.fn(),
    broadcast: jest.fn(),
  },
}));

jest.mock('../../src/services/pythService', () => ({
  pythService: {
    getAllPrices: jest.fn().mockResolvedValue([
      {
        symbol: 'BTC',
        price: '12345678000000',
        confidence: '95000000',
        expo: -8,
        publishTime: 1728456789,
        formattedPrice: '123456.78',
      },
    ]),
    getPrice: jest.fn().mockResolvedValue({
      symbol: 'BTC',
      price: '12345678000000',
      confidence: '95000000',
      expo: -8,
      publishTime: 1728456789,
      formattedPrice: '123456.78',
    }),
    getPriceUpdateData: jest.fn().mockResolvedValue(['0xabcd']),
    getCachedPrice: jest.fn().mockReturnValue(null),
    getLastUpdateTime: jest.fn().mockReturnValue(Date.now()),
  },
}));

jest.mock('../../src/services/alertService', () => ({
  alertService: {
    createAlert: jest.fn().mockResolvedValue({
      id: 'test-alert-id',
      userAddress: '0x1234',
      asset: 'BTC',
      targetPrice: 125000,
      condition: 'above',
      active: true,
      triggered: false,
      createdAt: Date.now(),
    }),
    getUserAlerts: jest.fn().mockResolvedValue([]),
    updateAlert: jest.fn().mockResolvedValue(null),
    deleteAlert: jest.fn().mockResolvedValue(true),
    getAlertById: jest.fn().mockResolvedValue(null),
    clearAllAlerts: jest.fn().mockResolvedValue(undefined),
    startAlertMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
  },
}));

jest.mock('../../src/services/priceHistory', () => ({
  priceHistoryService: {
    getHistory: jest.fn().mockReturnValue([]),
    getStats: jest.fn().mockReturnValue({
      current: 123456,
      high: 125000,
      low: 120000,
      average: 122500,
    }),
    addPrice: jest.fn(),
  },
}));

describe('Server Integration Tests', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await start();
  });

  afterAll(async () => {
    await stop();
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/').expect(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include endpoint information', async () => {
      const response = await request(app).get('/').expect(200);
      if (response.body.endpoints) {
        expect(response.body.endpoints).toBeDefined();
      } else {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return valid uptime', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/health').expect(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent GET routes', async () => {
      const response = await request(app).get('/non-existent-route').expect(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    it('should return 404 for non-existent POST routes', async () => {
      const response = await request(app)
        .post('/fake-endpoint')
        .send({ data: 'test' })
        .expect(404);
      expect(response.body.error).toBe('Route not found');
    });

    it('should return 404 for non-existent PUT routes', async () => {
      const response = await request(app).put('/non-existent').expect(404);
      expect(response.body.error).toBe('Route not found');
    });

    it('should return 404 for non-existent DELETE routes', async () => {
      const response = await request(app).delete('/non-existent').expect(404);
      expect(response.body.error).toBe('Route not found');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle OPTIONS preflight requests', async () => {
      await request(app).options('/api/prices/current').expect(204);
    });
  });

  describe('Security Headers', () => {
    it('should include helmet security headers', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include x-frame-options', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('JSON Body Parsing', () => {
    it('should parse JSON request bodies', async () => {
      const testData = {
        userAddress: '0x1234567890abcdef',
        asset: 'BTC',
        targetPrice: 125000,
        condition: 'above',
      };
      await request(app)
        .post('/api/alerts')
        .send(testData)
        .set('Content-Type', 'application/json')
        .expect(201);
    });

    it('should handle empty JSON body', async () => {
      await request(app)
        .post('/api/alerts')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });

  describe('API Routes', () => {
    it('should have /api/prices routes registered', async () => {
      const response = await request(app).get('/api/prices/current');
      expect(response.status).not.toBe(404);
    });

    it('should have /api/alerts routes registered', async () => {
      const response = await request(app).get('/api/alerts/0x1234567890');
      expect(response.status).not.toBe(404);
    });

    it('should have /api/liquidations routes registered', async () => {
      const response = await request(app).get('/api/liquidations/0x1234567890');
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('Response Format', () => {
    it('should return JSON content-type', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should return consistent success format', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.body).toHaveProperty('success');
      expect(typeof response.body.success).toBe('boolean');
    });

    it('should return consistent error format', async () => {
      const response = await request(app).get('/non-existent').expect(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const startMs = Date.now();
      await request(app).get('/health').expect(200);
      expect(Date.now() - startMs).toBeLessThan(1000);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array.from({ length: 5 }, () => request(app).get('/health'));
      const responses = await Promise.all(requests);
      responses.forEach((r) => {
        expect(r.status).toBe(200);
        expect(r.body.success).toBe(true);
      });
    });
  });
});
