import { WebSocket } from 'ws';
import { pythService } from './pythService';
import { priceHistoryService } from './priceHistory';
import { logger } from '../utils/logger';

class WebSocketService {
  private clients: Set<WebSocket>;
  private priceStreamInterval: NodeJS.Timeout | null;

  constructor() {
    this.clients = new Set();
    this.priceStreamInterval = null;
  }

  addClient(ws: WebSocket) {
    this.clients.add(ws);
    logger.info(`WebSocket client added. Total: ${this.clients.size}`);
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
    logger.info(`WebSocket client removed. Total: ${this.clients.size}`);
  }

  handleMessage(_ws: WebSocket, data: any) {
    const { type } = data;

    switch (type) {
      case 'subscribe_prices':
        logger.info('Client subscribed to price updates');
        break;
      case 'unsubscribe_prices':
        logger.info('Client unsubscribed from price updates');
        break;
      default:
        logger.warn('Unknown message type:', type);
    }
  }

  broadcast(message: any) {
    const payload = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  startPriceStreaming() {
    if (this.priceStreamInterval) {
      return;
    }

    logger.info('Starting price streaming service');

    this.priceStreamInterval = setInterval(async () => {
      try {
        const prices = await pythService.getAllPrices();

        prices.forEach(({ symbol, formattedPrice }) => {
          priceHistoryService.recordPrice(symbol, parseFloat(formattedPrice));
        });

        this.broadcast({
          type: 'price_update',
          data: prices,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error streaming prices:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  stopPriceStreaming() {
    if (this.priceStreamInterval) {
      clearInterval(this.priceStreamInterval);
      this.priceStreamInterval = null;
      logger.info('Price streaming service stopped');
    }
  }
}

export const websocketService = new WebSocketService();