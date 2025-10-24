import { useState, useEffect, useCallback } from 'react';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

interface PriceData {
  id: string;
  price: string;
  confidence: string;
  expo: number;
  publishTime: number;
  formattedPrice: string;
  rawPrice: number;
}

const PRICE_SERVICE_URL = 'https://hermes.pyth.network';

export const PRICE_FEEDS = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  CFX: '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
} as const;

export function usePythPrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<EvmPriceServiceConnection | null>(null);

  useEffect(() => {
    const priceService = new EvmPriceServiceConnection(PRICE_SERVICE_URL);
    setConnection(priceService);

    const fetchPrices = async () => {
      try {
        const priceIds = Object.values(PRICE_FEEDS);
        const priceFeeds = await priceService.getLatestPriceFeeds(priceIds);

        if (!priceFeeds || priceFeeds.length === 0) {
          throw new Error('No price feeds received from Pyth Network');
        }

        const newPrices: Record<string, PriceData> = {};

        priceFeeds.forEach((feed) => {
          const price = feed.getPriceUnchecked();
          
          const symbol = Object.entries(PRICE_FEEDS).find(
            ([, feedId]) => feedId === `0x${feed.id}`
          )?.[0];

          if (!symbol) {
            console.warn('Unknown price feed:', feed.id);
            return;
          }

          const rawPrice = Number(price.price) * Math.pow(10, price.expo);
          
          const formattedPrice = Number(rawPrice.toFixed(4)).toString();

          newPrices[symbol] = {
            id: feed.id,
            price: price.price,
            confidence: price.conf,
            expo: price.expo,
            publishTime: price.publishTime,
            formattedPrice,
            rawPrice,
          };

          console.log(`🔄 ${symbol}/USD Update:`, {
            raw: price.price,
            expo: price.expo,
            calculated: rawPrice,
            formatted: formattedPrice,
            time: new Date(price.publishTime * 1000).toLocaleTimeString(),
            timestamp: price.publishTime
          });
        });

        console.log('✅ All prices updated:', Object.keys(newPrices));
        setPrices(newPrices);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('❌ Error fetching prices:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
        setLoading(false);
      }
    };

    fetchPrices();
    
    const interval = setInterval(() => {
      console.log('⏰ Fetching new prices...');
      fetchPrices();
    }, 5000);

    return () => {
      console.log('🛑 Stopping price updates');
      clearInterval(interval);
    };
  }, []);

  const getPriceUpdateData = useCallback(
    async (priceIds: string[]) => {
      if (!connection) return [];
      
      try {
        const updateData = await connection.getPriceFeedsUpdateData(priceIds);
        return updateData;
      } catch (err) {
        console.error('Error getting update data:', err);
        return [];
      }
    },
    [connection]
  );

  return { prices, loading, error, getPriceUpdateData, PRICE_FEEDS };
}