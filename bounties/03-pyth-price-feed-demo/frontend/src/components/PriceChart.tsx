import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePythPrices } from '../hooks/usePythPrices';

interface PricePoint {
  timestamp: number;
  price: number;
  confidence: number;
}

interface PriceChartProps {
  symbol: string;
}

export default function PriceChart({ symbol }: PriceChartProps) {
  const { prices } = usePythPrices();
  const [allData, setAllData] = useState<PricePoint[]>([]);
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H' | '7D'>('1H');
  const [isLive, setIsLive] = useState(false);
  const lastRecordTimeRef = useRef<number>(0);

  useEffect(() => {
    const storageKey = `pythHistory_${symbol}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAllData(parsed);
        console.log(`📦 Loaded ${parsed.length} historical Pyth points for ${symbol}`);
      } catch (e) {
        console.error('Failed to parse stored Pyth history', e);
      }
    }
  }, [symbol]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentPriceData = prices[symbol];
      const now = Date.now();
      
      if (currentPriceData && now - lastRecordTimeRef.current >= 5000) {
        const currentPrice = parseFloat(currentPriceData.formattedPrice);
        const confidence = Number(currentPriceData.confidence) * Math.pow(10, currentPriceData.expo);
        
        if (isNaN(currentPrice) || currentPrice <= 0) {
          console.warn(`Invalid price for ${symbol}:`, currentPrice);
          return;
        }

        const newPoint: PricePoint = {
          timestamp: now,
          price: currentPrice,
          confidence: Math.abs(confidence),
        };

        setAllData((prev) => {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          const filtered = prev.filter(p => p.timestamp > sevenDaysAgo);
          
          const updated = [...filtered, newPoint];
          
          const storageKey = `pythHistory_${symbol}`;
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to save to localStorage', e);
          }
          
          return updated;
        });
        
        lastRecordTimeRef.current = now;
        
        setIsLive(true);
        setTimeout(() => setIsLive(false), 1000);
        
        console.log(`✅ Pyth price recorded for ${symbol}:`, currentPrice);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [symbol, prices]);

  const getFilteredData = (): PricePoint[] => {
    const now = Date.now();
    const timeframes = {
      '1H': 60 * 60 * 1000,
      '6H': 6 * 60 * 60 * 1000,
      '24H': 24 * 60 * 60 * 1000,
      '7D': 7 * 24 * 60 * 60 * 1000,
    };
    
    const cutoff = now - timeframes[timeRange];
    const filtered = allData.filter(p => p.timestamp >= cutoff);
    
    if (filtered.length === 0 && allData.length > 0) {
      return allData.slice(-10);
    }
    
    return filtered;
  };

  const filteredData = getFilteredData();

  const currentPriceData = prices[symbol];
  const livePrice = currentPriceData ? parseFloat(currentPriceData.formattedPrice) : 0;

  const stats = (() => {
    if (filteredData.length === 0) {
      return {
        current: livePrice,
        high: livePrice,
        low: livePrice,
        change: 0,
        dataPoints: 0,
      };
    }

    const allPrices = filteredData.map(d => d.price).filter(p => p > 0 && !isNaN(p));
    if (livePrice > 0 && !isNaN(livePrice)) {
      allPrices.push(livePrice);
    }
    
    const validPrices = allPrices.filter(p => isFinite(p));
    
    if (validPrices.length === 0) {
      return {
        current: livePrice,
        high: livePrice,
        low: livePrice,
        change: 0,
        dataPoints: 0,
      };
    }
    
    const currentDisplayPrice = livePrice > 0 ? livePrice : filteredData[filteredData.length - 1].price;
    const high = Math.max(...validPrices);
    const low = Math.min(...validPrices);
    const firstPrice = filteredData[0].price;
    const change = firstPrice > 0 ? ((currentDisplayPrice - firstPrice) / firstPrice) * 100 : 0;
    
    return {
      current: currentDisplayPrice,
      high: high,
      low: low,
      change: change,
      dataPoints: filteredData.length,
    };
  })();

  const isPositive = stats.change >= 0;
  const chartColor = isPositive ? '#10b981' : '#ef4444';

  const formatPrice = (value: number) => {
    if (value >= 10000) {
      return `$${(value / 1000).toFixed(1)}k`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else {
      return `$${value.toFixed(4)}`;
    }
  };

  const formatStatPrice = (value: number) => {
    if (!isFinite(value) || isNaN(value)) return '$0.00';
    if (value >= 1000) {
      return value.toFixed(2);
    } else if (value >= 1) {
      return value.toFixed(2);
    } else {
      return value.toFixed(4);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1H' || timeRange === '6H') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24H') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    }
  };

  const getTimeMessage = () => {
    const timeframes = {
      '1H': 60,
      '6H': 360,
      '24H': 1440,
      '7D': 10080,
    };
    
    const requiredMinutes = timeframes[timeRange];
    const currentMinutes = Math.floor((allData.length * 5) / 60);
    const remainingMinutes = Math.max(0, requiredMinutes - currentMinutes);
    
    if (remainingMinutes > 60) {
      return `Building history... (~${Math.ceil(remainingMinutes / 60)}h remaining)`;
    } else if (remainingMinutes > 0) {
      return `Building history... (~${remainingMinutes}m remaining)`;
    }
    return null;
  };

  if (filteredData.length === 0) {
    const timeMessage = getTimeMessage();
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-700 font-medium mb-2">Recording Pyth Price Data</p>
            <p className="text-sm text-gray-500 mb-1">
              Collecting real-time prices for {symbol}
            </p>
            {allData.length > 0 && (
              <div className="mt-3 text-xs text-gray-400">
                <p>{allData.length} price points recorded</p>
                {timeMessage && <p className="mt-1">{timeMessage}</p>}
              </div>
            )}
            {allData.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Data will appear within 30 seconds
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">{symbol}/USD Price Chart</h3>
          
          <div className="flex items-center space-x-2">
            <div className={`relative flex h-3 w-3 ${isLive ? 'animate-ping' : ''}`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
            <span className="text-xs font-medium text-gray-600">LIVE</span>
            <span className="text-xs text-blue-600 font-medium">Pyth Oracle</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {(['1H', '6H', '24H', '7D'] as const).map((range) => (
            <button
              key={range}
              onClick={() => {
                console.log(`Switching ${symbol} to ${range}`);
                setTimeRange(range);
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? isPositive 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id={`gradient-${symbol}-green`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={`gradient-${symbol}-red`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            minTickGap={50}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={formatPrice}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            labelFormatter={(timestamp) => new Date(timestamp as number).toLocaleString()}
            formatter={(value: number) => [`$${formatStatPrice(value)}`, 'Price']}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: `2px solid ${chartColor}`,
              borderRadius: '8px',
              padding: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={chartColor}
            strokeWidth={2}
            fill={`url(#gradient-${symbol}-${isPositive ? 'green' : 'red'})`}
            name="Price"
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-4 gap-4 text-sm">
        <div className={`rounded-lg p-3 border-2 transition-colors ${
          isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-gray-500 mb-1">Current</p>
          <p className={`font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
            ${formatStatPrice(stats.current)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
          <p className="text-gray-500 mb-1">High ({timeRange})</p>
          <p className="font-bold text-green-600">${formatStatPrice(stats.high)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
          <p className="text-gray-500 mb-1">Low ({timeRange})</p>
          <p className="font-bold text-red-600">${formatStatPrice(stats.low)}</p>
        </div>
        <div className={`rounded-lg p-3 border-2 transition-colors ${
          isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-gray-500 mb-1">Change ({timeRange})</p>
          <p className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{stats.change.toFixed(2)}%
          </p>
        </div>
      </div>

      {stats.dataPoints < 100 && (
        <div className="mt-4 text-xs text-center text-blue-600">
          📈 Building history: {stats.dataPoints} Pyth data points recorded
        </div>
      )}
    </div>
  );
}

