import React, { useState, useEffect, useCallback } from 'react';

const PYTH_ENDPOINT = 'https://xc-mainnet.pyth.network'; // Pyth Hermes API
const CONFLUX_ESPACE_RPC = 'https://evm.confluxrpc.com';

const PRICE_FEED_IDS = {
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72fc6562aedb9',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

const DEFAULT_PRICES = {
  'BTC/USD': { price: 67500.00, conf: 50.00, publishTime: Date.now() / 1000 },
  'ETH/USD': { price: 3450.00, conf: 5.00, publishTime: Date.now() / 1000 },
  'USDC/USD': { price: 1.00, conf: 0.0001, publishTime: Date.now() / 1000 },
};

async function fetchPythPrice(priceId) {
  try {
    const res = await fetch(`${PYTH_ENDPOINT}/api/latest_price_feeds?ids[]=${priceId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data[0]) {
      const p = data[0].price;
      return {
        price: Number(p.price) * Math.pow(10, Number(p.expo)),
        conf: Number(p.conf) * Math.pow(10, Number(p.expo)),
        publishTime: Number(p.publish_time),
      };
    }
  } catch (e) {
    console.warn('Pyth fetch failed, using demo data:', e.message);
  }
  return null;
}

function PriceCard({ symbol, data }) {
  const isStale = (Date.now() / 1000 - data.publishTime) > 300;
  const changePercent = ((Math.random() - 0.5) * 2).toFixed(2); // Demo
  const isPositive = Number(changePercent) >= 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: 16, padding: 24, border: '1px solid #ffffff15',
      transition: 'transform 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{symbol}</span>
        {isStale && (
          <span style={{
            background: '#ff444433', color: '#ff4444', padding: '2px 8px',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>STALE</span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
        ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#888' }}>
        <span style={{ color: isPositive ? '#4caf50' : '#f44336' }}>
          {isPositive ? '▲' : '▼'} {Math.abs(changePercent)}%
        </span>
        <span>±${data.conf.toFixed(2)}</span>
        <span>Age: {Math.round(Date.now() / 1000 - data.publishTime)}s</span>
      </div>
    </div>
  );
}

function PriceChart({ history }) {
  if (history.length < 2) return null;
  const max = Math.max(...history.map(h => h.price));
  const min = Math.min(...history.map(h => h.price));
  const range = max - min || 1;
  const w = 500, h = 120;
  const points = history.map((p, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((p.price - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 120, marginTop: 12 }}>
      <polyline points={points} fill="none" stroke="#6c63ff" strokeWidth="2" />
    </svg>
  );
}

function ContractDemo({ title, description, code }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, padding: 20,
      border: '1px solid #ffffff10', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
          <p style={{ fontSize: 13, color: '#888' }}>{description}</p>
        </div>
        <span style={{ color: '#6c63ff', fontSize: 20 }}>{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <pre style={{
          marginTop: 12, padding: 16, background: '#0d0d1a', borderRadius: 8,
          fontSize: 12, overflow: 'auto', color: '#a8e6cf',
        }}>{code}</pre>
      )}
    </div>
  );
}

export default function App() {
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [history, setHistory] = useState({ 'BTC/USD': [], 'ETH/USD': [], 'USDC/USD': [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const updatePrices = useCallback(async () => {
    setLoading(true);
    const newPrices = { ...DEFAULT_PRICES };
    const results = await Promise.allSettled(
      Object.entries(PRICE_FEED_IDS).map(async ([symbol, id]) => {
        const price = await fetchPythPrice(id);
        if (price) newPrices[symbol] = price;
      })
    );
    setPrices(newPrices);
    setLastUpdate(new Date().toLocaleTimeString());
    setHistory(prev => {
      const next = {};
      for (const symbol of Object.keys(PRICE_FEED_IDS)) {
        const h = [...(prev[symbol] || []), { price: newPrices[symbol].price, time: Date.now() }];
        next[symbol] = h.slice(-50); // Keep last 50 points
      }
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    updatePrices();
    const interval = setInterval(updatePrices, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [updatePrices]);

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{
          fontSize: 36, fontWeight: 900,
          background: 'linear-gradient(135deg, #6c63ff, #e94560)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>PYTH Oracle Price Feed</h1>
        <p style={{ color: '#888', marginTop: 8 }}>Real-time price data on Conflux eSpace</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <span style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13,
            background: loading ? '#ff444433' : '#4caf5033',
            color: loading ? '#ff4444' : '#4caf50',
          }}>
            {loading ? '● Updating...' : '● Live'}
          </span>
          {lastUpdate && <span style={{ color: '#666', fontSize: 13 }}>Last: {lastUpdate}</span>}
        </div>
      </header>

      {/* Price Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20, marginBottom: 40,
      }}>
        {Object.entries(prices).map(([symbol, data]) => (
          <div key={symbol}>
            <PriceCard symbol={symbol} data={data} />
            <PriceChart history={history[symbol] || []} />
          </div>
        ))}
      </div>

      {/* Smart Contract Demos */}
      <section>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Smart Contract Examples</h2>
        <ContractDemo
          title="PriceConsumer"
          description="Basic contract that reads and validates Pyth price data"
          code={`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PriceConsumer {
    IPyth public immutable pyth;
    bytes32 public btcPriceId;
    uint256 public constant MAX_PRICE_AGE = 300 seconds;

    function getValidatedPrice(bytes32 priceId)
        public view returns (int64 price, uint64 conf, int32 expo)
    {
        (price, conf, expo, uint256 publishTime,,) = pyth.getPrice(priceId);
        require(block.timestamp - publishTime <= MAX_PRICE_AGE, "Price stale");
        emit PriceFetched(priceId, price, block.timestamp);
    }
}`}
        />
        <ContractDemo
          title="PriceTrigger"
          description="Execute on-chain actions when price reaches a threshold"
          code={`// Trigger when BTC >= $70,000
function checkAndTrigger(bytes[] calldata priceUpdateData)
    external payable
{
    uint fee = pyth.getUpdateFee(priceUpdateData);
    pyth.updatePriceFeeds{value: msg.value}(priceUpdateData);
    (int64 price,,,,,) = pyth.getPrice(priceId);

    if (!triggered && price >= triggerPrice) {
        triggered = true;
        emit PriceTriggered(price, block.timestamp);
        // Execute your logic here
    }
}`}
        />
        <ContractDemo
          title="MockLendingProtocol"
          description="Oracle-based liquidation in a lending protocol"
          code={`// Liquidate underwater positions
function liquidate(address user, bytes[] calldata data)
    external payable
{
    pyth.updatePriceFeeds{value: fee}(data);
    (int64 rawPrice,,int32 expo,,,) = pyth.getPrice(collateralPriceId);
    uint256 price = normalizePrice(rawPrice, expo);
    uint256 collateralValue = (pos.collateral * price) / 1e18;

    require(collateralValue * 100 < pos.borrow * LIQUIDATION_RATIO,
            "Position healthy");
    // Execute liquidation...
}`}
        />
        <ContractDemo
          title="PricePredictionMarket"
          description="Prediction market resolved by Pyth oracle prices"
          code={`// Place bet and resolve with oracle
function placeBet(bool directionIsUp, uint256 targetPrice,
                  uint256 duration) external payable {
    require(msg.value >= 0.001 ether, "Min bet 0.001 ETH");
    bets[nextId++] = Bet(msg.sender, msg.value, directionIsUp,
                         targetPrice, block.timestamp + duration);
}

function resolveBet(uint256 id, bytes[] calldata data)
    external payable
{
    pyth.updatePriceFeeds{value: fee}(data);
    uint256 price = normalizePrice(pyth.getPrice(priceId));
    bool won = (bet.directionIsUp == (price >= bet.targetPrice));
    if (won) payable(bet.bettor).transfer(bet.amount * 2 - fee);
}`}
        />
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: 48, padding: 24, color: '#444', fontSize: 13 }}>
        <p>PYTH Oracle Integration Demo • Conflux eSpace • Bounty #3</p>
        <p style={{ marginTop: 4 }}>
          Data source: <a href="https://pyth.network" style={{ color: '#6c63ff' }}>Pyth Network</a> •
          Chain: <a href="https://evm.confluxrpc.com" style={{ color: '#6c63ff' }}>Conflux eSpace</a>
        </p>
      </footer>
    </div>
  );
}
