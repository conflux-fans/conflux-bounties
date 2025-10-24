import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { usePythPrices } from '../hooks/usePythPrices';
import { BETTING_CONTRACT_ADDRESS, BETTING_ABI } from '../lib/contractABI';

interface Bet {
  id: number;
  asset: string;
  priceId: string;
  amount: string;
  targetPrice: string;
  predictAbove: boolean;
  deadline: number;
  settled: boolean;
  won: boolean;
  bettor: string;
}

export default function BettingInterface() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const { prices, PRICE_FEEDS } = usePythPrices();
  const publicClient = usePublicClient();

  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [betAmount, setBetAmount] = useState('0.1');
  const [targetPrice, setTargetPrice] = useState('');
  const [predictAbove, setPredictAbove] = useState(true);
  const [duration, setDuration] = useState('3600');
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settlingBetId, setSettlingBetId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setBetAmount('0.1');
      setTargetPrice('');
      setError('');
      setSettlingBetId(null);
      setTimeout(fetchUserBets, 3000);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (writeError) {
      setError(writeError.message);
      console.error('Transaction error:', writeError);
      setSettlingBetId(null);
    }
  }, [writeError]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserBets();
    }
  }, [isConnected, address]);

  const fetchUserBets = async () => {
    if (!address || !publicClient) {
      console.log('❌ No address or publicClient');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Fetching bets for:', address);

      const nextId = await publicClient.readContract({
        address: BETTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: BETTING_ABI,
        functionName: 'nextBetId',
      }) as bigint;

      console.log('📊 Total bets in contract:', nextId.toString());

      if (nextId === 0n) {
        console.log('ℹ️ No bets in contract');
        setUserBets([]);
        setLoading(false);
        return;
      }

      const allBets: Bet[] = [];

      for (let i = 0; i < Number(nextId); i++) {
        try {
          console.log(`📖 Reading bet ${i}...`);
          
          const betData = await publicClient.readContract({
            address: BETTING_CONTRACT_ADDRESS as `0x${string}`,
            abi: BETTING_ABI,
            functionName: 'bets',
            args: [BigInt(i)],
          }) as readonly [string, string, bigint, bigint, bigint, boolean, boolean, boolean];

          const [bettor, priceId, amount, targetPrice, deadline, predictAbove, settled, won] = betData;

          if (bettor && bettor.toLowerCase() === address.toLowerCase()) {
            const assetEntry = Object.entries(PRICE_FEEDS).find(
              ([_, id]) => id.toLowerCase() === priceId.toLowerCase()
            );
            const assetName = assetEntry?.[0] || 'Unknown';

            const userBet: Bet = {
              id: i,
              asset: assetName,
              priceId: priceId,
              amount: formatEther(amount),
              targetPrice: (Number(targetPrice) / 1e8).toFixed(2),
              predictAbove: predictAbove,
              deadline: Number(deadline),
              settled: settled,
              won: won,
              bettor: bettor,
            };

            allBets.push(userBet);
            console.log(`✅ Added bet #${i} to list`);
          }
        } catch (err: any) {
          console.error(`❌ Error reading bet ${i}:`, err.message);
        }
      }

      console.log(`📈 Total user bets found: ${allBets.length}`);
      setUserBets(allBets);

    } catch (error: any) {
      console.error('❌ Fatal error:', error);
      setError('Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!address || !targetPrice) {
      setError('Please enter a target price');
      return;
    }

    const targetPriceNum = Number(targetPrice);
    if (targetPriceNum <= 0) {
      setError('Target price must be greater than 0');
      return;
    }

    const maxInt64 = 9223372036854775807n;
    const targetPriceScaled = BigInt(Math.floor(targetPriceNum * 1e8));
    
    if (targetPriceScaled > maxInt64 || targetPriceScaled <= 0n) {
      setError('Target price is out of valid range');
      return;
    }

    const betValue = parseFloat(betAmount);
    if (betValue < 0.01) {
      setError('Minimum bet amount is 0.01 CFX');
      return;
    }

    if (betValue > 100) {
      setError('Maximum bet amount is 100 CFX');
      return;
    }

    if (balance && parseFloat(balance.formatted) < betValue) {
      setError('Insufficient balance');
      return;
    }

    try {
      setError('');
      const priceId = PRICE_FEEDS[selectedAsset as keyof typeof PRICE_FEEDS];

      console.log('Placing bet:', {
        priceId,
        targetPrice: targetPriceScaled.toString(),
        predictAbove,
        duration,
        value: betAmount
      });

      writeContract({
        address: BETTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: BETTING_ABI,
        functionName: 'placeBet',
        args: [priceId, targetPriceScaled, predictAbove, BigInt(duration)],
        value: parseEther(betAmount),
      });

    } catch (err) {
      console.error('Error placing bet:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const handleSettleBet = async (bet: Bet) => {
    setSettlingBetId(bet.id);
    setError('');

    try {
      console.log('⚙️ Settling bet #', bet.id);
      console.log('Contract uses getPriceUnsafe() internally');

      writeContract({
        address: BETTING_CONTRACT_ADDRESS as `0x${string}`,
        abi: BETTING_ABI,
        functionName: 'settleBet',
        args: [BigInt(bet.id)],
      });

      console.log('✅ Settlement transaction submitted');

    } catch (err) {
      console.error('Error settling bet:', err);
      setError(err instanceof Error ? err.message : 'Failed to settle bet');
      setSettlingBetId(null);
    }
  };

  const currentPrice = prices[selectedAsset]?.formattedPrice || '0';
  const potentialWin = Number(betAmount) * 1.96;

  const displayedBets = showHistory 
    ? userBets 
    : userBets.filter(bet => !bet.settled);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Betting Form */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Price Prediction Market</h2>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">⚠️ {error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => {
                setSelectedAsset(e.target.value);
                setTargetPrice('');
              }}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              {Object.keys(prices).map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}/USD - ${parseFloat(prices[symbol]?.formattedPrice || '0').toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Current Price Display */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-100">
            <p className="text-sm text-gray-600 mb-2">Current Market Price</p>
            <p className="text-4xl font-bold text-blue-600">
              ${parseFloat(currentPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
              })}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Updated {Math.floor(Date.now() / 1000 - (prices[selectedAsset]?.publishTime || Date.now() / 1000))}s ago
            </p>
            {prices[selectedAsset] && (Date.now() / 1000 - prices[selectedAsset].publishTime) > 120 && (
              <p className="text-xs text-yellow-600 mt-1">⚠️ Price may be stale</p>
            )}
          </div>

          {/* Balance Display */}
          {isConnected && balance && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Your Balance:</span>
                <span className="font-semibold text-gray-900">
                  {parseFloat(balance.formatted).toFixed(4)} CFX
                </span>
              </div>
            </div>
          )}

          {/* Bet Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bet Amount (CFX)
            </label>
            <div className="relative">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                step="0.01"
                min="0.01"
                max="100"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <span className="absolute right-4 top-3 text-gray-500 font-medium">CFX</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum: 0.01 CFX | Maximum: 100 CFX</p>
          </div>

          {/* Target Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Price ($)
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              step={parseFloat(currentPrice) < 1 ? "0.0001" : "0.01"}
              min="0.01"
              placeholder={`Current: $${currentPrice}`}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">Must be a positive number</p>
          </div>

          {/* Prediction Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Your Prediction
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPredictAbove(true)}
                className={`py-4 rounded-lg font-semibold transition-all ${
                  predictAbove
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="text-2xl mb-1 block">📈</span>
                Above Target
              </button>
              <button
                onClick={() => setPredictAbove(false)}
                className={`py-4 rounded-lg font-semibold transition-all ${
                  !predictAbove
                    ? 'bg-red-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="text-2xl mb-1 block">📉</span>
                Below Target
              </button>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution Time
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="3600">1 Hour</option>
              <option value="21600">6 Hours</option>
              <option value="86400">1 Day</option>
              <option value="259200">3 Days</option>
              <option value="604800">1 Week</option>
            </select>
          </div>

          {/* Bet Summary */}
          {targetPrice && (
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-2">Bet Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Asset:</span>
                  <span className="font-medium">{selectedAsset}/USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Price:</span>
                  <span className="font-medium">${currentPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Target Price:</span>
                  <span className="font-medium">${targetPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Prediction:</span>
                  <span className={`font-medium ${predictAbove ? 'text-green-600' : 'text-red-600'}`}>
                    {predictAbove ? 'Above' : 'Below'} ${targetPrice}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bet Amount:</span>
                  <span className="font-medium">{betAmount} CFX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fee (4%):</span>
                  <span className="font-medium">{(Number(betAmount) * 0.04).toFixed(4)} CFX</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 italic">
                  <span>Fee is 2% of total payout (2x bet)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-300">
                  <span className="text-gray-900 font-semibold">Potential Win:</span>
                  <span className="font-bold text-green-600">
                    {potentialWin.toFixed(4)} CFX
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Place Bet Button */}
          <button
            onClick={handlePlaceBet}
            disabled={!isConnected || isPending || isConfirming || !targetPrice}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 rounded-lg font-bold hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-lg"
          >
            {!isConnected
              ? 'Connect Wallet to Place Bet'
              : isPending
              ? 'Confirming Transaction...'
              : isConfirming
              ? 'Processing on Blockchain...'
              : 'Place Bet'}
          </button>

          {hash && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                Transaction Hash: <span className="font-mono break-all">{hash.slice(0, 10)}...{hash.slice(-8)}</span>
              </p>
            </div>
          )}

          {isSuccess && !settlingBetId && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Bet placed successfully! Loading your bets...
              </p>
            </div>
          )}

          {isSuccess && settlingBetId !== null && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Bet settled successfully! Refreshing...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Active Bets Sidebar */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Bets</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                showHistory 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showHistory ? 'All' : 'Active'}
            </button>
            <button
              onClick={fetchUserBets}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400"
              title="Refresh bets"
            >
              {loading ? '⟳' : '🔄'}
            </button>
          </div>
        </div>
        
        {!isConnected ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-3xl mb-2">🔐</p>
            <p>Connect wallet to view your bets</p>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p>Scanning bets...</p>
          </div>
        ) : displayedBets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-3xl mb-2">🎲</p>
            <p>{showHistory ? 'No bets found' : 'No active bets'}</p>
            <p className="text-sm mt-2">
              {showHistory 
                ? 'Place your first bet to get started!' 
                : 'Toggle "All" to see history'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {displayedBets.map((bet) => (
              <BetCard 
                key={bet.id} 
                bet={bet} 
                currentPrices={prices}
                onSettle={handleSettleBet}
                isSettling={settlingBetId === bet.id}
                isPending={isPending}
                isConfirming={isConfirming}
              />
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">How It Works</h4>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 font-semibold">1</span>
              <span>Select asset and enter target price</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 font-semibold">2</span>
              <span>Predict if price will be above or below</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 font-semibold">3</span>
              <span>Choose duration and place bet</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 font-semibold">4</span>
              <span>Win 1.96x if prediction is correct!</span>
            </li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> Settlement uses cached Pyth prices. No additional fees required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BetCardProps {
  bet: Bet;
  currentPrices: any;
  onSettle: (bet: Bet) => void;
  isSettling: boolean;
  isPending: boolean;
  isConfirming: boolean;
}

function BetCard({ bet, currentPrices, onSettle, isSettling, isPending, isConfirming }: BetCardProps) {
  const currentPrice = parseFloat(currentPrices[bet.asset]?.formattedPrice || '0');
  const targetPrice = parseFloat(bet.targetPrice);
  const timeRemaining = bet.deadline - Math.floor(Date.now() / 1000);
  const isExpired = timeRemaining <= 0;

  const getStatus = () => {
    if (bet.settled) {
      return bet.won ? 'Won ✅' : 'Lost ❌';
    }
    if (isExpired) return 'Ready to Settle';
    if (bet.predictAbove && currentPrice >= targetPrice) return 'Winning 🎯';
    if (!bet.predictAbove && currentPrice <= targetPrice) return 'Winning 🎯';
    return 'Active ⏳';
  };

  const status = getStatus();
  const statusColor = bet.settled 
    ? (bet.won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
    : (status.includes('Winning') ? 'bg-green-100 text-green-700' :
       isExpired ? 'bg-yellow-100 text-yellow-700' :
       'bg-blue-100 text-blue-700');

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-4 border-2 transition-all ${
      bet.settled ? 'border-gray-300 opacity-75' : 'border-gray-200 hover:border-blue-300'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-gray-900">{bet.asset}/USD</span>
          <span className={`text-xs font-semibold ${bet.predictAbove ? 'text-green-600' : 'text-red-600'}`}>
            {bet.predictAbove ? '📈' : '📉'}
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
          {status}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Bet ID:</span>
          <span className="font-medium">#{bet.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Target:</span>
          <span className="font-medium">${parseFloat(bet.targetPrice).toLocaleString()}</span>
        </div>
        {!bet.settled && (
          <div className="flex justify-between">
            <span className="text-gray-600">Current:</span>
            <span className="font-medium">${currentPrice.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Bet Amount:</span>
          <span className="font-medium">{parseFloat(bet.amount).toFixed(4)} CFX</span>
        </div>
        {!bet.settled ? (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Potential Win:</span>
              <span className="font-bold text-green-600">
                {(parseFloat(bet.amount) * 1.96).toFixed(4)} CFX
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Resolves in:</span>
              <span className="font-medium">{formatTime(timeRemaining)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-gray-600">Result:</span>
            <span className={`font-bold ${bet.won ? 'text-green-600' : 'text-red-600'}`}>
              {bet.won ? `+${(parseFloat(bet.amount) * 1.96).toFixed(4)} CFX` : `-${parseFloat(bet.amount).toFixed(4)} CFX`}
            </span>
          </div>
        )}
      </div>

      {isExpired && !bet.settled && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <button
            onClick={() => onSettle(bet)}
            disabled={isSettling || isPending || isConfirming}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2 px-4 rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all text-sm shadow-md"
          >
            {isSettling && isPending
              ? '⏳ Confirming...'
              : isSettling && isConfirming
              ? '⏳ Settling...'
              : '🎯 Settle Bet'}
          </button>
        </div>
      )}
    </div>
  );
}

