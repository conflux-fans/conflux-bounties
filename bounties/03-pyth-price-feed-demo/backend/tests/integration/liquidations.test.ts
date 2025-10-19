import request from 'supertest';
import express from 'express';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Liquidations API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/liquidations/opportunities', () => {
    it('should return liquidation opportunities', async () => {
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/opportunities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeDefined();
    });

    it('should return empty array for opportunities', async () => {
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/opportunities')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle errors when fetching opportunities', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      
      const module = require('../../src/routes/liquidations');
      module._enableTestError(true);
      
      app.use('/api/liquidations', module.default);

      const response = await request(app)
        .get('/api/liquidations/opportunities')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch liquidation opportunities');
      expect(logger.error).toHaveBeenCalled();
      
      module._enableTestError(false);
    });
  });

  describe('GET /api/liquidations/history', () => {
    it('should return liquidation history', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.metadata).toBeDefined();
    });

    it('should respect limit and offset parameters', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history?limit=10&offset=5')
        .expect(200);

      expect(response.body.metadata.limit).toBe(10);
      expect(response.body.metadata.offset).toBe(5);
      expect(response.body.metadata.total).toBe(0);
    });

    it('should use default limit and offset', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history')
        .expect(200);

      expect(response.body.metadata.limit).toBe(50);
      expect(response.body.metadata.offset).toBe(0);
    });

    it('should return empty array for history', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.metadata.total).toBe(0);
    });

    it('should handle string parameters', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history?limit=25&offset=10')
        .expect(200);

      expect(response.body.metadata.limit).toBe(25);
      expect(response.body.metadata.offset).toBe(10);
    });

    it('should have correct metadata structure', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history')
        .expect(200);

      expect(response.body.metadata).toHaveProperty('limit');
      expect(response.body.metadata).toHaveProperty('offset');
      expect(response.body.metadata).toHaveProperty('total');
    });

    it('should handle errors when fetching history', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      
      const module = require('../../src/routes/liquidations');
      module._enableTestError(true);
      
      app.use('/api/liquidations', module.default);

      const response = await request(app)
        .get('/api/liquidations/history')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch liquidation history');
      expect(logger.error).toHaveBeenCalled();
      
      module._enableTestError(false);
    });

    it('should handle large limit values', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history?limit=1000')
        .expect(200);

      expect(response.body.metadata.limit).toBe(1000);
    });

    it('should handle zero values', async () => {
      delete require.cache[require.resolve('../../src/routes/liquidations')];
      
      const app = express();
      app.use(express.json());
      const liquidationsRouter = require('../../src/routes/liquidations').default;
      app.use('/api/liquidations', liquidationsRouter);

      const response = await request(app)
        .get('/api/liquidations/history?limit=0&offset=0')
        .expect(200);

      expect(response.body.metadata.limit).toBe(0);
      expect(response.body.metadata.offset).toBe(0);
    });
  });
});