import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

const HERMES_URL = 'https://hermes.pyth.network';

export class PythClient {
  private connection: EvmPriceServiceConnection;

  constructor() {
    this.connection = new EvmPriceServiceConnection(HERMES_URL);
  }

  async getLatestPrices(priceIds: string[]) {
    try {
      const priceFeeds = await this.connection.getLatestPriceFeeds(priceIds);
      return priceFeeds;
    } catch (error) {
      console.error('Error fetching prices from Pyth:', error);
      throw error;
    }
  }

  async getPriceUpdateData(priceIds: string[]) {
    try {
      const updateData = await this.connection.getPriceFeedsUpdateData(priceIds);
      return updateData;
    } catch (error) {
      console.error('Error getting price update data:', error);
      throw error;
    }
  }

  streamPrices(priceIds: string[], callback: (prices: any) => void) {
    const ws = new WebSocket(`wss://hermes.pyth.network/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        ids: priceIds,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => ws.close();
  }
}

export const pythClient = new PythClient();