import React from 'react';
import { Web3Provider } from './providers/Web3Provider';
import Layout from './components/Layout';
import PriceDashboard from './components/PriceDashboard';
import BettingInterface from './components/BettingInterface';
import LiquidationMonitor from './components/LiquidationMonitor';
import AlertManager from './components/AlertManager';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'betting' | 'lending' | 'alerts'>('dashboard');

  return (
    <Web3Provider>
      <Layout>
        <div className="mb-6">
          <nav className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('betting')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'betting'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Prediction Market
            </button>
            <button
              onClick={() => setActiveTab('lending')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'lending'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lending Protocol
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'alerts'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Price Alerts
            </button>
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 'dashboard' && <PriceDashboard />}
          {activeTab === 'betting' && <BettingInterface />}
          {activeTab === 'lending' && <LiquidationMonitor />}
          {activeTab === 'alerts' && <AlertManager />}
        </div>
      </Layout>
    </Web3Provider>
  );
}

export default App;