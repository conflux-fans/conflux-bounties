import { useState, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI } from '../lib/contractABI';
import { usePythPrices } from './usePythPrices';

interface Position {
  id: number;
  borrower: string;
  collateralAsset: string;
  borrowAsset: string;
  collateral: string;
  borrowed: string;
  collateralValue: string;
  borrowValue: string;
  healthRatio: number;
  active: boolean;
  openTime: number;
}

export function useLiquidations() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { prices, PRICE_FEEDS } = usePythPrices();

  const [positions, setPositions] = useState<Position[]>([]);
  const [liquidatablePositions, setLiquidatablePositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!publicClient || !address || Object.keys(prices).length === 0) {
      console.log('⏸️ Waiting for requirements...');
      return;
    }

    setLoading(true);

    try {
      console.log('🔍 Fetching positions...');

      const activePositionIds = await publicClient.readContract({
        address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
        abi: LENDING_ABI,
        functionName: 'getAllActivePositions',
      }) as bigint[];

      if (!activePositionIds || activePositionIds.length === 0) {
        console.log('ℹ️ No active positions');
        setPositions([]);
        setLiquidatablePositions([]);
        setLoading(false);
        return;
      }

      const allPositions: Position[] = [];
      const liquidatable: Position[] = [];

      for (const positionId of activePositionIds) {
        try {
          const positionData = await publicClient.readContract({
            address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
            abi: LENDING_ABI,
            functionName: 'positions',
            args: [positionId],
          }) as readonly [string, string, string, bigint, bigint, bigint, boolean];

          if (!positionData || positionData.length !== 7) continue;

          const [borrower, collateralAsset, borrowAsset, collateralAmount, borrowAmount, openTime, active] = positionData;

          if (!active || borrower === '0x0000000000000000000000000000000000000000') continue;

          const healthRatio = await publicClient.readContract({
            address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
            abi: LENDING_ABI,
            functionName: 'getHealthRatio',
            args: [positionId],
          }) as bigint;

          const collateralAssetName = Object.entries(PRICE_FEEDS).find(
            ([_, id]) => id.toLowerCase() === collateralAsset.toLowerCase()
          )?.[0] || 'Unknown';

          const borrowAssetName = Object.entries(PRICE_FEEDS).find(
            ([_, id]) => id.toLowerCase() === borrowAsset.toLowerCase()
          )?.[0] || 'Unknown';

          const collateralPrice = parseFloat(prices[collateralAssetName]?.formattedPrice || '0');
          const borrowPrice = parseFloat(prices[borrowAssetName]?.formattedPrice || '0');

          const collateralInEth = parseFloat(formatEther(collateralAmount));
          const borrowInEth = parseFloat(formatEther(borrowAmount));

          const position: Position = {
            id: Number(positionId),
            borrower,
            collateralAsset: collateralAssetName,
            borrowAsset: borrowAssetName,
            collateral: collateralInEth.toFixed(4),
            borrowed: borrowInEth.toFixed(4),
            collateralValue: (collateralInEth * collateralPrice).toFixed(2),
            borrowValue: (borrowInEth * borrowPrice).toFixed(2),
            healthRatio: Number(healthRatio) / 100,
            active,
            openTime: Number(openTime),
          };

          allPositions.push(position);

          if (position.healthRatio < 150) {
            liquidatable.push(position);
          }
        } catch (err: any) {
          console.error(`Error reading position ${positionId}:`, err.message);
        }
      }

      const userPositions = allPositions.filter(
        p => p.borrower.toLowerCase() === address.toLowerCase()
      );

      console.log(`✅ Loaded ${userPositions.length} positions`);
      setPositions(userPositions);
      setLiquidatablePositions(liquidatable);
    } catch (error: any) {
      console.error('❌ Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, prices, PRICE_FEEDS]);

  return {
    positions,
    liquidatablePositions,
    loading,
    fetchPositions,
  };
}

