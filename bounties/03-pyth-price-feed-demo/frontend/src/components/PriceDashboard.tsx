import React from 'react';
import { usePythPrices } from '../hooks/usePythPrices';
import PriceChart from './PriceChart';

export default function PriceDashboard() {
  const { prices, loading, error } = usePythPrices();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading price feeds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-red-900 font-semibold">Error Loading Prices</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(prices).map(([symbol, data]) => (
          <PriceCard key={symbol} symbol={symbol} data={data} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(prices).map((symbol) => (
          <PriceChart key={symbol} symbol={symbol} />
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Market Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Assets" 
            value={Object.keys(prices).length.toString()} 
            icon="📊"
          />
          <StatCard 
            title="Active Feeds" 
            value={Object.values(prices).filter(p => p.publishTime > Date.now() / 1000 - 60).length.toString()} 
            icon="🔄"
          />
          <StatCard 
            title="Update Frequency" 
            value="~5s" 
            icon="⚡"
          />
        </div>
      </div>
    </div>
  );
}

interface PriceCardProps {
  symbol: string;
  data: {
    formattedPrice: string;
    confidence: string;
    publishTime: number;
    expo: number;
    rawPrice?: number;
  };
}

function PriceCard({ symbol, data }: PriceCardProps) {
  const timeSinceUpdate = Math.floor(Date.now() / 1000 - data.publishTime);
  const isFresh = timeSinceUpdate < 60;

  const getSymbolLogo = (sym: string) => {
    switch(sym) {
      case 'BTC': return '/bitcoin.png';
      case 'ETH': return '/ethereum.png';
      case 'CFX': return '/conflux.png';
      default: return null;
    }
  };

  const getSymbolIcon = (sym: string) => {
    switch(sym) {
      case 'BTC': return '₿';
      case 'ETH': return 'Ξ';
      case 'CFX': return '⚡';
      default: return '💎';
    }
  };

  const getSymbolColor = (sym: string) => {
    switch(sym) {
      case 'BTC': return 'from-orange-400 to-orange-600';
      case 'ETH': return 'from-purple-400 to-purple-600';
      case 'CFX': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const formatPrice = (priceStr: string) => {
    const price = parseFloat(priceStr);
    
    if (isNaN(price)) return '0.00';
    
    if (price >= 10000) {
      return price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else if (price >= 100) {
      return price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else if (price >= 1) {
      return price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
    } else {
      return price.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 6
      });
    }
  };

  const logoPath = getSymbolLogo(symbol);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getSymbolColor(symbol)} flex items-center justify-center overflow-hidden`}>
            {logoPath ? (
              <img 
                src={logoPath} 
                alt={`${symbol} logo`}
                className="w-full h-full object-cover p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-white text-2xl font-bold">${getSymbolIcon(symbol)}</span>`;
                  }
                }}
              />
            ) : (
              <span className="text-white text-2xl font-bold">{getSymbolIcon(symbol)}</span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{symbol}/USD</h3>
            <p className="text-xs text-gray-500">Pyth Network • Real-time</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isFresh
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {isFresh ? '● Live' : `${timeSinceUpdate}s ago`}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-4xl font-bold text-gray-900">
          ${formatPrice(data.formattedPrice)}
        </p>
        
        {parseFloat(data.formattedPrice) < 1 && (
          <p className="text-sm text-gray-500 mt-1 font-mono">
            Exact: ${parseFloat(data.formattedPrice).toFixed(8)}
          </p>
        )}
        
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">Confidence:</span>
          <span className="text-gray-700 font-medium">
            ±${(Number(data.confidence) * Math.pow(10, data.expo)).toFixed(
              parseFloat(data.formattedPrice) < 1 ? 4 : 2
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">Last Update</span>
          <span className="text-gray-900 font-medium">
            {new Date(data.publishTime * 1000).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Freshness</span>
          <span className={`font-medium ${isFresh ? 'text-green-600' : 'text-yellow-600'}`}>
            {timeSinceUpdate}s ago
          </span>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
      <div className="flex items-center space-x-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

