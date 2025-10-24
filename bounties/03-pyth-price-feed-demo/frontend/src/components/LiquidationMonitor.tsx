import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { usePythPrices } from '../hooks/usePythPrices';
import { useLiquidations } from '../hooks/useLiquidations';
import { LENDING_CONTRACT_ADDRESS, LENDING_ABI } from '../lib/contractABI';

export default function LiquidationMonitor() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const publicClient = usePublicClient();
  const { prices, PRICE_FEEDS } = usePythPrices();
  const { positions, liquidatablePositions, fetchPositions, loading } = useLiquidations();

  const [showOpenPosition, setShowOpenPosition] = useState(false);
  const [collateralAsset, setCollateralAsset] = useState('ETH');
  const [borrowAsset, setBorrowAsset] = useState('ETH');
  const [collateralAmount, setCollateralAmount] = useState('1');
  const [borrowAmount, setBorrowAmount] = useState('0.5');
  const [contractBalance, setContractBalance] = useState('0');
  const [error, setError] = useState('');

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (publicClient && address && Object.keys(prices).length > 0) {
      fetchPositions();
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        fetchPositions();
        fetchContractBalance();
      }, 3000);
      setShowOpenPosition(false);
      setError('');
    }
  }, [isSuccess]);

  useEffect(() => {
    if (writeError) {
      setError(writeError.message);
      console.error('Transaction error:', writeError);
    }
  }, [writeError]);

  useEffect(() => {
    if (publicClient) {
      fetchContractBalance();
      const interval = setInterval(fetchContractBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [publicClient]);

  const fetchContractBalance = async () => {
    if (!publicClient) return;
    
    try {
      const contractBal = await publicClient.getBalance({
        address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
      });
      setContractBalance(formatEther(contractBal));
    } catch (err) {
      console.error('Error fetching contract balance:', err);
    }
  };

  const handleRefresh = () => {
    fetchPositions();
    fetchContractBalance();
  };

  const handleOpenPosition = async () => {
    if (!address) {
      setError('Please connect wallet');
      return;
    }

    const borrowValue = parseFloat(borrowAmount);
    const contractBal = parseFloat(contractBalance);
    
    if (contractBal < borrowValue) {
      setError(`Insufficient contract liquidity. Available: ${contractBal.toFixed(4)} CFX`);
      return;
    }

    const collateralValue = parseFloat(collateralAmount);
    if (collateralValue < 0.01) {
      setError('Minimum collateral is 0.01 CFX');
      return;
    }

    if (borrowValue <= 0) {
      setError('Borrow amount must be greater than 0');
      return;
    }

    if (balance && parseFloat(balance.formatted) < collateralValue) {
      setError('Insufficient balance');
      return;
    }

    if (healthRatio < 150) {
      setError('Health ratio must be at least 150%');
      return;
    }

    try {
      setError('');
      const collateralPriceId = PRICE_FEEDS[collateralAsset as keyof typeof PRICE_FEEDS];
      const borrowPriceId = PRICE_FEEDS[borrowAsset as keyof typeof PRICE_FEEDS];

      writeContract({
        address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
        abi: LENDING_ABI,
        functionName: 'openPosition',
        args: [collateralPriceId, borrowPriceId, parseEther(borrowAmount)],
        value: parseEther(collateralAmount),
      });
    } catch (error: any) {
      console.error('Error opening position:', error);
      setError(error.message || 'Failed to open position');
    }
  };

  const handleLiquidate = async (positionId: number) => {
    try {
      setError('');
      writeContract({
        address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
        abi: LENDING_ABI,
        functionName: 'liquidate',
        args: [BigInt(positionId)],
      });
    } catch (error: any) {
      setError(error.message || 'Failed to liquidate');
    }
  };

  const handleRepay = async (positionId: number, borrowAmount: string) => {
    try {
      setError('');
      writeContract({
        address: LENDING_CONTRACT_ADDRESS as `0x${string}`,
        abi: LENDING_ABI,
        functionName: 'repayPosition',
        args: [BigInt(positionId)],
        value: parseEther(borrowAmount),
      });
    } catch (error: any) {
      setError(error.message || 'Failed to repay');
    }
  };

  const calculateHealthRatio = (collateral: number, borrow: number) => {
    if (borrow === 0) return Infinity;
    return (collateral / borrow) * 100;
  };

  const collateralPrice = parseFloat(prices[collateralAsset]?.formattedPrice || '0');
  const borrowPrice = parseFloat(prices[borrowAsset]?.formattedPrice || '0');
  const collateralValue = parseFloat(collateralAmount) * collateralPrice;
  const borrowValue = parseFloat(borrowAmount) * borrowPrice;
  const healthRatio = calculateHealthRatio(collateralValue, borrowValue);

  return (
    <div className="space-y-6">
      {/* Header with Contract Balance */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lending Protocol Monitor</h2>
          <p className="text-gray-600 mt-1">
            Contract Balance: <span className="font-semibold text-blue-600">{parseFloat(contractBalance).toFixed(4)} CFX</span>
          </p>
        </div>
        <button
          onClick={() => setShowOpenPosition(!showOpenPosition)}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-semibold"
        >
          {showOpenPosition ? 'Cancel' : '+ Open Position'}
        </button>
      </div>

      {/* Low Liquidity Warning */}
      {parseFloat(contractBalance) < 1 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">
            ⚠️ Low contract liquidity ({contractBalance} CFX). Contact admin to add liquidity.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Open Position Form */}
      {showOpenPosition && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Open Lending Position</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collateral Asset
              </label>
              <select
                value={collateralAsset}
                onChange={(e) => setCollateralAsset(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.keys(prices).map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol} - ${prices[symbol]?.formattedPrice}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collateral Amount
              </label>
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                step="0.01"
                min="0.01"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Value: ${collateralValue.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Borrow Asset
              </label>
              <select
                value={borrowAsset}
                onChange={(e) => setBorrowAsset(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.keys(prices).map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol} - ${prices[symbol]?.formattedPrice}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Borrow Amount
              </label>
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                step="0.01"
                min="0"
                max={contractBalance}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Value: ${borrowValue.toFixed(2)} | Available: {parseFloat(contractBalance).toFixed(4)} CFX
              </p>
            </div>
          </div>

          {/* Health Ratio Display */}
          <div className={`mt-6 p-4 rounded-lg ${
            healthRatio >= 150 ? 'bg-green-50 border-2 border-green-200' :
            healthRatio >= 120 ? 'bg-yellow-50 border-2 border-yellow-200' :
            'bg-red-50 border-2 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Health Ratio</p>
                <p className={`text-3xl font-bold ${
                  healthRatio >= 150 ? 'text-green-600' :
                  healthRatio >= 120 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {healthRatio.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Liquidation Threshold: 150%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {healthRatio >= 150 ? '✓ Healthy' : healthRatio >= 120 ? '⚠ At Risk' : '✗ Liquidatable'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenPosition}
            disabled={!isConnected || isPending || isConfirming || healthRatio < 150}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {!isConnected ? 'Connect Wallet' : isPending || isConfirming ? 'Processing...' : 'Open Position'}
          </button>
        </div>
      )}

      {/* Transaction Status */}
      {hash && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            Transaction Hash: <span className="font-mono break-all">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
          </p>
        </div>
      )}

      {isSuccess && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-semibold flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Transaction successful! Refreshing in 3 seconds...
          </p>
        </div>
      )}

      {/* Liquidatable Positions */}
      {liquidatablePositions.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Liquidatable Positions ({liquidatablePositions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liquidatablePositions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onLiquidate={handleLiquidate}
                isPending={isPending}
                showActions
              />
            ))}
          </div>
        </div>
      )}

      {/* User Positions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Positions</h3>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 flex items-center gap-1"
            title="Refresh positions"
          >
            <span className={loading ? 'animate-spin' : ''}>{loading ? '⟳' : '🔄'}</span>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {!isConnected ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">🔐</p>
            <p>Connect wallet to view your positions</p>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading positions...</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-3xl mb-2">📊</p>
            <p>No open positions</p>
            <p className="text-sm mt-2">Open a position to start borrowing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onRepay={handleRepay}
                isPending={isPending}
                showRepay
              />
            ))}
          </div>
        )}
      </div>

      {/* Protocol Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Contract Balance"
          value={`${parseFloat(contractBalance).toFixed(2)} CFX`}
          icon="💰"
          color="purple"
        />
        <StatCard
          title="Total Positions"
          value={positions.length.toString()}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Liquidatable"
          value={liquidatablePositions.length.toString()}
          icon="⚠️"
          color="red"
        />
        <StatCard
          title="Liquidation Bonus"
          value="5%"
          icon="🎁"
          color="green"
        />
      </div>
    </div>
  );
}

interface PositionCardProps {
  position: any;
  onLiquidate?: (id: number) => void;
  onRepay?: (id: number, amount: string) => void;
  isPending?: boolean;
  showActions?: boolean;
  showRepay?: boolean;
}

function PositionCard({ position, onLiquidate, onRepay, isPending, showActions, showRepay }: PositionCardProps) {
  const healthColor = position.healthRatio >= 150 ? 'green' : position.healthRatio >= 120 ? 'yellow' : 'red';

  return (
    <div className={`bg-white rounded-lg p-4 border-2 ${
      healthColor === 'green' ? 'border-green-200' :
      healthColor === 'yellow' ? 'border-yellow-200' :
      'border-red-200'
    } hover:shadow-lg transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-gray-900">Position #{position.id}</span>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          healthColor === 'green' ? 'bg-green-100 text-green-700' :
          healthColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {position.healthRatio.toFixed(0)}%
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Collateral:</span>
          <span className="font-medium">{position.collateral} {position.collateralAsset}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Borrowed:</span>
          <span className="font-medium">{position.borrowed} {position.borrowAsset}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Collateral Value:</span>
          <span className="font-medium">${position.collateralValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Borrow Value:</span>
          <span className="font-medium">${position.borrowValue}</span>
        </div>
      </div>

      {showActions && onLiquidate && position.healthRatio < 150 && (
        <button
          onClick={() => onLiquidate(position.id)}
          disabled={isPending}
          className="w-full mt-3 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
        >
          {isPending ? 'Liquidating...' : 'Liquidate Position'}
        </button>
      )}

      {showRepay && onRepay && (
        <button
          onClick={() => onRepay(position.id, position.borrowed)}
          disabled={isPending}
          className="w-full mt-3 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
        >
          {isPending ? 'Repaying...' : 'Repay & Close'}
        </button>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'red' | 'green' | 'purple';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    red: 'from-red-50 to-red-100 border-red-200',
    green: 'from-green-50 to-green-100 border-green-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg p-6 border-2`}>
      <div className="flex items-center space-x-3">
        <span className="text-4xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

