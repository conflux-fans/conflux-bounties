import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { logger } from '../utils/logger';

const HERMES_URL = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network';

const PRICE_FEEDS = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  CFX: '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
} as const;

interface PriceData {
  symbol: string;
  price: string;
  confidence: string;
  expo: number;
  publishTime: number;
  formattedPrice: string;
}

export class PythService {
  private connection: EvmPriceServiceConnection;
  private priceCache: Map<string, PriceData>;
  private lastUpdate: number;

  constructor() {
    this.connection = new EvmPriceServiceConnection(HERMES_URL);
    this.priceCache = new Map();
    this.lastUpdate = 0;
  }

  async getAllPrices(): Promise<PriceData[]> {
    try {
      const priceIds = Object.values(PRICE_FEEDS);
      const priceFeeds = await this.connection.getLatestPriceFeeds(priceIds);

      const prices: PriceData[] = [];

      priceFeeds?.forEach((feed) => {
        const price = feed.getPriceUnchecked();
        const symbol = Object.keys(PRICE_FEEDS).find(
          key => PRICE_FEEDS[key as keyof typeof PRICE_FEEDS] === `0x${feed.id}`
        ) || feed.id;

        const formattedPrice = (
          Number(price.price) * Math.pow(10, price.expo)
        ).toFixed(2);

        const priceData: PriceData = {
          symbol,
          price: price.price,
          confidence: price.conf,
          expo: price.expo,
          publishTime: price.publishTime,
          formattedPrice,
        };

        prices.push(priceData);
        this.priceCache.set(symbol, priceData);
      });

      this.lastUpdate = Date.now();
      return prices;
    } catch (error) {
      logger.error('Error fetching prices from Pyth:', error);
      throw error;
    }
  }

  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      const priceId = PRICE_FEEDS[symbol as keyof typeof PRICE_FEEDS];
      if (!priceId) {
        return null;
      }

      const priceFeeds = await this.connection.getLatestPriceFeeds([priceId]);
      if (!priceFeeds || priceFeeds.length === 0) {
        return null;
      }

      const feed = priceFeeds[0];
      const price = feed.getPriceUnchecked();

      const formattedPrice = (
        Number(price.price) * Math.pow(10, price.expo)
      ).toFixed(2);

      const priceData: PriceData = {
        symbol,
        price: price.price,
        confidence: price.conf,
        expo: price.expo,
        publishTime: price.publishTime,
        formattedPrice,
      };

      this.priceCache.set(symbol, priceData);
      return priceData;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    try {
      const updateData = await this.connection.getPriceFeedsUpdateData(priceIds);
      return updateData;
    } catch (error) {
      logger.error('Error getting price update data:', error);
      throw error;
    }
  }

  getCachedPrice(symbol: string): PriceData | undefined {
    return this.priceCache.get(symbol);
  }

  getLastUpdateTime(): number {
    return this.lastUpdate;
  }
}

export const pythService = new PythService();