import { Router, Request, Response } from 'express';
import { pythService } from '../services/pythService';
import { priceHistoryService } from '../services/priceHistory';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/prices/current
 * Get current prices for all assets
 */
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const prices = await pythService.getAllPrices();
    res.json({
      success: true,
      data: prices,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Error fetching current prices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prices',
    });
  }
});

/**
 * GET /api/prices/:symbol
 * Get current price for specific asset
 */
router.get('/:symbol', async (req: Request, res: Response) : Promise<void> => {
  try {
    const { symbol } = req.params;
    const price = await pythService.getPrice(symbol.toUpperCase());
    
    if (!price) {
      res.status(404).json({
        success: false,
        error: 'Asset not found',
      });
      return;
    }

    res.json({
      success: true,
      data: price,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error(`Error fetching price for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price',
    });
  }
});

/**
 * GET /api/prices/:symbol/history
 * Get price history for specific asset
 */
router.get('/:symbol/history', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1h', limit = 100 } = req.query;

    const history = await priceHistoryService.getHistory(
      symbol.toUpperCase(),
      timeframe as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: history,
      metadata: {
        symbol: symbol.toUpperCase(),
        timeframe,
        count: history.length,
      },
    });
  } catch (error) {
    logger.error(`Error fetching price history for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history',
    });
  }
});

/**
 * GET /api/prices/:symbol/stats
 * Get price statistics for specific asset
 */
router.get('/:symbol/stats', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '24h' } = req.query;

    const stats = await priceHistoryService.getStats(
      symbol.toUpperCase(),
      timeframe as string
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`Error fetching stats for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * POST /api/prices/update
 * Get price update data for on-chain updates
 */
router.post('/update', async (req: Request, res: Response) : Promise<void> => {
  try {
    const { priceIds } = req.body;

    if (!Array.isArray(priceIds) || priceIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid priceIds array',
      });
      return;
    }

    const updateData = await pythService.getPriceUpdateData(priceIds);

    res.json({
      success: true,
      data: updateData,
    });
  } catch (error) {
    logger.error('Error getting price update data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update data',
    });
  }
});

export default router;