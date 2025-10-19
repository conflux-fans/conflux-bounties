import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePythPrices } from '../hooks/usePythPrices';

interface Alert {
  id: string;
  asset: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  triggered: boolean;
  createdAt: number;
  expiresAt?: number;
  repeating: boolean;
  repeatInterval?: number;
  note?: string;
  alertType: 'price' | 'percentage';
  percentageChange?: number;
  basePrice?: number;
}

const ALERT_TEMPLATES = [
  { name: '🔽 Quick Buy', condition: 'below' as const, offset: -5 },
  { name: '💰 Take Profit', condition: 'above' as const, offset: 10 },
  { name: '🛑 Stop Loss', condition: 'below' as const, offset: -10 },
  { name: '🚀 Breakout', condition: 'above' as const, offset: 15 },
];

export default function PriceAlerts() {
  const { prices } = usePythPrices();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  const [alertType, setAlertType] = useState<'price' | 'percentage'>('price');
  const [percentageChange, setPercentageChange] = useState('5');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [repeating, setRepeating] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState<number>(60);
  const [note, setNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const triggeredAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const savedAlerts = localStorage.getItem('priceAlerts');
    if (savedAlerts) {
      try {
        setAlerts(JSON.parse(savedAlerts));
      } catch (error) {
        console.error('Failed to load alerts:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (alerts.length > 0) {
      localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    } else {
      localStorage.removeItem('priceAlerts');
    }
  }, [alerts]);

  useEffect(() => {
    const checkExpiry = () => {
      const now = Date.now();
      setAlerts(prev => {
        const updated = prev.map(alert => {
          if (alert.expiresAt && alert.expiresAt < now && alert.active) {
            console.log(`Alert ${alert.id} expired`);
            return { ...alert, active: false };
          }
          return alert;
        });
        
        const hasChanges = updated.some((alert, idx) => alert.active !== prev[idx].active);
        return hasChanges ? updated : prev;
      });
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;

    alerts.forEach(alert => {
      if (!alert.active || alert.triggered) return;
      if (alert.expiresAt && alert.expiresAt < Date.now()) return;
      if (triggeredAlertsRef.current.has(alert.id)) return;

      const currentPrice = parseFloat(prices[alert.asset]?.formattedPrice || '0');
      if (currentPrice === 0) return;

      let shouldTrigger = false;

      if (alert.alertType === 'percentage' && alert.basePrice) {
        const percentChange = ((currentPrice - alert.basePrice) / alert.basePrice) * 100;
        
        if (alert.condition === 'above' && percentChange >= (alert.percentageChange || 0)) {
          shouldTrigger = true;
        } else if (alert.condition === 'below' && percentChange <= -(alert.percentageChange || 0)) {
          shouldTrigger = true;
        }
      } else {
        if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }
      }

      if (shouldTrigger) {
        triggeredAlertsRef.current.add(alert.id);
        triggerAlert(alert, currentPrice);
      }
    });
  }, [prices]);

  const showInAppNotification = (alert: Alert, currentPrice: number) => {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'fixed top-4 right-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-lg shadow-2xl z-[9999] max-w-sm animate-slide-in-right';
    
    const emoji = alert.condition === 'above' ? '⬆️' : '⬇️';
    const priceDisplay = alert.alertType === 'price' 
      ? `$${alert.targetPrice.toLocaleString()}` 
      : `${alert.percentageChange}%`;
    
    notificationDiv.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="text-3xl">🔔</div>
        <div class="flex-1">
          <p class="font-bold text-lg">Price Alert!</p>
          <p class="text-sm mt-1">
            ${alert.asset}/USD ${emoji} ${priceDisplay}
          </p>
          <p class="text-xs mt-1 opacity-90">
            Current: $${currentPrice.toLocaleString()}
          </p>
        </div>
        <button class="text-white hover:text-gray-200 text-2xl leading-none" onclick="this.parentElement.parentElement.remove()">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(notificationDiv);
    
    setTimeout(() => {
      notificationDiv.style.opacity = '0';
      notificationDiv.style.transition = 'opacity 0.5s';
      setTimeout(() => notificationDiv.remove(), 500);
    }, 8000);
  };

  const triggerAlert = useCallback(async (alert: Alert, currentPrice: number) => {
    console.log('Alert triggered:', alert.id);

    if ('Notification' in window && notificationPermission === 'granted') {
      try {
        const notificationBody = alert.alertType === 'percentage'
          ? `${alert.asset}/USD moved ${alert.percentageChange}% ${alert.condition === 'above' ? 'up' : 'down'}! Current: $${currentPrice.toLocaleString()}, Base: $${alert.basePrice?.toLocaleString()}`
          : `${alert.asset}/USD ${alert.condition === 'above' ? 'rose above' : 'fell below'} your target! Target: $${alert.targetPrice.toLocaleString()}, Current: $${currentPrice.toLocaleString()}`;

        const notification = new Notification('Price Alert Triggered', {
          body: notificationBody,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `alert-${alert.id}`,
          requireInteraction: false,
          silent: false
        });

        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }

        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          notification.close();
        };

        setTimeout(() => notification.close(), 10000);
      } catch (error) {
        console.error('Failed to create notification:', error);
        showInAppNotification(alert, currentPrice);
      }
    } else {
      showInAppNotification(alert, currentPrice);
    }

    try {
      const audio = new Audio('/notification.wav');
      audio.volume = 0.5;
      await audio.play();
    } catch (e) {
      console.log('Audio failed:', e);
    }

    if (alert.repeating && alert.repeatInterval) {
      setTimeout(() => {
        triggeredAlertsRef.current.delete(alert.id);
        setAlerts(prev =>
          prev.map(a =>
            a.id === alert.id 
              ? { ...a, triggered: false, active: true } 
              : a
          )
        );
      }, alert.repeatInterval * 60 * 1000);
      
      setAlerts(prev =>
        prev.map(a =>
          a.id === alert.id ? { ...a, triggered: true } : a
        )
      );
    } else {
      setAlerts(prev =>
        prev.map(a =>
          a.id === alert.id ? { ...a, triggered: true, active: false } : a
        )
      );
    }
  }, [notificationPermission]);

  const handleApplyTemplate = (template: typeof ALERT_TEMPLATES[0]) => {
    const currentPrice = parseFloat(prices[selectedAsset]?.formattedPrice || '0');
    if (currentPrice === 0) {
      alert('Price not available yet');
      return;
    }
    
    const targetPrice = currentPrice * (1 + template.offset / 100);
    setCondition(template.condition);
    setTargetPrice(targetPrice.toFixed(2));
    setAlertType('price');
  };

  const handleAddAlert = () => {
    const currentPrice = parseFloat(prices[selectedAsset]?.formattedPrice || '0');

    if (alertType === 'price' && (!targetPrice || parseFloat(targetPrice) <= 0)) {
      alert('Please enter a valid target price');
      return;
    }

    if (alertType === 'percentage' && (!percentageChange || parseFloat(percentageChange) <= 0)) {
      alert('Please enter a valid percentage');
      return;
    }

    if (currentPrice === 0) {
      alert('Price data not available yet. Please wait.');
      return;
    }

    const newAlert: Alert = {
      id: Date.now().toString(),
      asset: selectedAsset,
      targetPrice: alertType === 'price' ? parseFloat(targetPrice) : 0,
      condition,
      active: true,
      triggered: false,
      createdAt: Date.now(),
      expiresAt: expiryHours > 0 ? Date.now() + (expiryHours * 60 * 60 * 1000) : undefined,
      repeating,
      repeatInterval: repeating ? repeatInterval : undefined,
      note: note.trim() || undefined,
      alertType,
      percentageChange: alertType === 'percentage' ? parseFloat(percentageChange) : undefined,
      basePrice: alertType === 'percentage' ? currentPrice : undefined,
    };

    setAlerts(prev => [...prev, newAlert]);
    
    setTargetPrice('');
    setPercentageChange('5');
    setNote('');
    setRepeating(false);
    setShowAdvanced(false);
  };

  const handleDeleteAlert = (id: string) => {
    triggeredAlertsRef.current.delete(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleToggleAlert = (id: string) => {
    triggeredAlertsRef.current.delete(id);
    setAlerts(prev =>
      prev.map(a =>
        a.id === id ? { ...a, active: !a.active, triggered: false } : a
      )
    );
  };

  const handleDeleteAll = () => {
    if (window.confirm('Delete all alerts? This cannot be undone.')) {
      triggeredAlertsRef.current.clear();
      setAlerts([]);
      localStorage.removeItem('priceAlerts');
    }
  };

  const handleEnableAll = () => {
    triggeredAlertsRef.current.clear();
    setAlerts(prev => prev.map(a => ({ ...a, active: true, triggered: false })));
  };

  const handleDisableAll = () => {
    setAlerts(prev => prev.map(a => ({ ...a, active: false })));
  };

  const handleTestNotification = async () => {
    if (!('Notification' in window)) {
      alert('Your browser does not support notifications');
      return;
    }

    if (notificationPermission !== 'granted') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== 'granted') {
        alert('Please enable notifications in browser settings');
        return;
      }
    }

    try {
      const notification = new Notification('Test Notification', {
        body: 'If you see this, notifications are working! Time: ' + new Date().toLocaleTimeString(),
        icon: '/favicon.ico',
        requireInteraction: true,
      });

      notification.onclick = () => {
        notification.close();
      };
    } catch (error) {
      alert(`Test failed: ${error}`);
    }
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Notifications not supported in this browser');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification('Notifications Enabled!', {
        body: 'You will now receive price alerts',
        icon: '/favicon.ico',
      });
    } else {
      alert('Notification permission denied. Enable in browser settings.');
    }
  };

  const activeAlerts = alerts.filter(a => a.active && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="space-y-6">
      {notificationPermission !== 'granted' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-800">Enable Notifications</p>
                <p className="text-sm text-yellow-700">
                  Allow notifications to receive price alerts
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {notificationPermission === 'granted' && (
        <div className="flex justify-end">
          <button
            onClick={handleTestNotification}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🧪 Test Notification
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <span className="mr-2">🔔</span>
          Create Price Alert
        </h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alert Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAlertType('price')}
              className={`p-3 rounded-lg border-2 transition-all ${
                alertType === 'price'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">💵</div>
              <div className="font-semibold">Price Target</div>
              <div className="text-xs opacity-75">Alert at specific price</div>
            </button>
            <button
              onClick={() => setAlertType('percentage')}
              className={`p-3 rounded-lg border-2 transition-all ${
                alertType === 'percentage'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">📊</div>
              <div className="font-semibold">Percentage Change</div>
              <div className="text-xs opacity-75">Alert on % movement</div>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Templates
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ALERT_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleApplyTemplate(template)}
                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all text-sm font-medium"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="CFX">Conflux (CFX)</option>
            </select>
            {prices[selectedAsset] && (
              <p className="text-sm text-gray-600 mt-1">
                Current: ${parseFloat(prices[selectedAsset].formattedPrice).toLocaleString()}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as 'above' | 'below')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="above">⬆️ Above (Price Rising)</option>
              <option value="below">⬇️ Below (Price Falling)</option>
            </select>
          </div>
        </div>

        {alertType === 'price' ? (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Price (USD)
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
            />
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Percentage Change (%)
            </label>
            <input
              type="number"
              value={percentageChange}
              onChange={(e) => setPercentageChange(e.target.value)}
              placeholder="e.g., 5 for 5% change"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.1"
              min="0"
            />
            {prices[selectedAsset] && (
              <p className="text-sm text-gray-600 mt-1">
                Base price: ${parseFloat(prices[selectedAsset].formattedPrice).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires After (hours) - 0 for never
              </label>
              <input
                type="number"
                value={expiryHours}
                onChange={(e) => setExpiryHours(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={repeating}
                onChange={(e) => setRepeating(e.target.checked)}
                id="repeating"
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="repeating" className="text-sm font-medium text-gray-700">
                Repeating Alert
              </label>
            </div>

            {repeating && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat Interval (minutes)
                </label>
                <input
                  type="number"
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note to remember why you set this alert"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleAddAlert}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold text-lg"
        >
          + Create Alert
        </button>
      </div>

      {activeAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center">
              <span className="mr-2">✅</span>
              Active Alerts ({activeAlerts.length})
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handleDisableAll}
                className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Disable All
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-l-4 border-green-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg font-bold">{alert.asset}/USD</span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        alert.condition === 'above'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {alert.condition === 'above' ? '⬆️ Above' : '⬇️ Below'}
                      </span>
                    </div>
                    
                    <p className="text-lg font-semibold text-gray-800">
                      {alert.alertType === 'price'
                        ? `$${alert.targetPrice.toLocaleString()}`
                        : `${alert.percentageChange}% change`}
                    </p>

                    {alert.alertType === 'percentage' && alert.basePrice && (
                      <p className="text-sm text-gray-600">
                        Base: ${alert.basePrice.toLocaleString()}
                      </p>
                    )}

                    {alert.note && (
                      <p className="text-sm text-gray-600 mt-1">📝 {alert.note}</p>
                    )}

                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                      <span>
                        Created: {new Date(alert.createdAt).toLocaleString()}
                      </span>
                      {alert.expiresAt && (
                        <span>
                          Expires: {new Date(alert.expiresAt).toLocaleString()}
                        </span>
                      )}
                      {alert.repeating && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          🔁 Repeats every {alert.repeatInterval}m
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleToggleAlert(alert.id)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {triggeredAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center">
              <span className="mr-2">🔕</span>
              Triggered Alerts ({triggeredAlerts.length})
            </h3>
            <button
              onClick={handleEnableAll}
              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Re-enable All
            </button>
          </div>

          <div className="space-y-3">
            {triggeredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-gray-100 rounded-lg border-l-4 border-gray-400 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg font-bold">{alert.asset}/USD</span>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-medium">
                        {alert.condition === 'above' ? '⬆️ Above' : '⬇️ Below'}
                      </span>
                      {alert.repeating && (
                        <span className="px-2 py-1 bg-blue-200 text-blue-700 rounded text-sm">
                          🔁 Will repeat
                        </span>
                      )}
                    </div>
                    
                    <p className="text-lg font-semibold text-gray-700">
                      {alert.alertType === 'price'
                        ? `$${alert.targetPrice.toLocaleString()}`
                        : `${alert.percentageChange}% change`}
                    </p>

                    {alert.note && (
                      <p className="text-sm text-gray-600 mt-1">📝 {alert.note}</p>
                    )}
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleToggleAlert(alert.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      Re-enable
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            No Active Alerts
          </h3>
          <p className="text-gray-600">
            Create your first price alert to get notified when prices move!
          </p>
        </div>
      )}
    </div>
  );
}
