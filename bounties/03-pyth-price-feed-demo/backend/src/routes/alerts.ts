import { Router, Request, Response } from 'express';
import { alertService } from '../services/alertService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/alerts
 * Create a new price alert
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress, asset, targetPrice, condition } = req.body;

    if (!userAddress || !asset || targetPrice === undefined || targetPrice === null || !condition) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
      return;
    }

    if (condition !== 'above' && condition !== 'below') {
      res.status(400).json({
        success: false,
        error: 'Condition must be "above" or "below"',
      });
      return;
    }

    const parsedPrice = parseFloat(targetPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({
        success: false,
        error: 'Target price must be a positive number',
      });
      return;
    }

    const alert = await alertService.createAlert({
      userAddress,
      asset: asset.toUpperCase(),
      targetPrice: parsedPrice,
      condition,
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert',
    });
  }
});

/**
 * GET /api/alerts/:userAddress
 * Get all alerts for a user
 */
router.get('/:userAddress', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userAddress } = req.params;

    if (!userAddress || userAddress.length < 10) {
      res.status(400).json({
        success: false,
        error: 'Invalid user address',
      });
      return;
    }

    const alerts = await alertService.getUserAlerts(userAddress);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

/**
 * PUT /api/alerts/:alertId
 * Update an alert
 */
router.put('/:alertId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const { active, targetPrice } = req.body;

    if (active === undefined && targetPrice === undefined) {
      res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
      return;
    }

    if (targetPrice !== undefined) {
      const parsedPrice = parseFloat(targetPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({
          success: false,
          error: 'Target price must be a positive number',
        });
        return;
      }
    }

    const alert = await alertService.updateAlert(alertId, {
      active,
      targetPrice: targetPrice !== undefined ? parseFloat(targetPrice) : undefined,
    });

    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    logger.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert',
    });
  }
});

/**
 * DELETE /api/alerts/:alertId
 * Delete an alert
 */
router.delete('/:alertId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const deleted = await alertService.deleteAlert(alertId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert',
    });
  }
});

export default router;