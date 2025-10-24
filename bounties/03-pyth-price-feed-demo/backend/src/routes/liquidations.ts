import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface LiquidationOpportunity {
  id: string;
  userAddress: string;
  collateral: string;
  debt: string;
  healthFactor: number;
}

interface LiquidationHistory {
  id: string;
  timestamp: number;
  liquidator: string;
  borrower: string;
  amount: string;
}

let testErrorMode = false;
export const _enableTestError = (enable: boolean) => {
  testErrorMode = enable;
};

/**
 * GET /api/liquidations/opportunities
 * Get all liquidatable positions
 */
router.get('/opportunities', async (_req: Request, res: Response) => {
  try {
    if (testErrorMode) {
      throw new Error('Test error - opportunities');
    }

    const opportunities: LiquidationOpportunity[] = [ 
    ];

    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
    });
  } catch (error) {
    logger.error('Error fetching liquidation opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidation opportunities',
    });
  }
});

/**
 * GET /api/liquidations/history
 * Get liquidation history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    if (testErrorMode) {
      throw new Error('Test error - history');
    }

    const { limit = 50, offset = 0 } = req.query;

    const history: LiquidationHistory[] = [];

    res.json({
      success: true,
      data: history,
      metadata: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: history.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching liquidation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidation history',
    });
  }
});

export default router;