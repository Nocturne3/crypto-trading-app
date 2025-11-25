import { useState, useEffect } from 'react';
import { getTop50Prices } from '../../services/api';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  loadNotificationSettings,
  saveNotificationSettings
} from '../../utils/storage';
import { initAlertService, stopAlertService, getAlertStatus } from '../../services/alertService';

/**
 * Settings Komponente - Enhanced Version
 * 
 * Verwaltet:
 * - Watchlist (Coins zum Beobachten)
 * - Notification-Einstellungen für verschiedene Signal-Typen
 * - NEU: Erweiterte Alert-Typen (Pullback, Entry Quality, etc.)
 * - NEU: Background-Polling Einstellungen
 * 
 * Props:
 * - onSymbolSelect: Callback wenn Symbol angeklickt wird (für Detail-Ansicht)
 */
export default function Settings({ onSymbolSelect }) {
  const [watchlist, setWatchlist] = useState([]);
  const [availableCoins, setAvailableCoins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [alertServiceStatus, setAlertServiceStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Lade Watchlist und Notification Settings
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        // Lade Watchlist
        const watchlistData = loadWatchlist();
        setWatchlist(watchlistData);

        // Lade Notification Settings
        const settings = loadNotificationSettings();
        setNotificationSettings(settings);

        // Prüfe Notification Permission
        if ('Notification' in window) {
          setNotificationPermission(Notification.permission);
        }

        // Hole Alert Service Status
        setAlertServiceStatus(getAlertStatus());

        // Hole verfügbare Coins
        const coins = await getTop50Prices();
        setAvailableCoins(coins);

        setLoading(false);
      } catch (error) {
        console.error('Error loading settings data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /**
   * Füge Coin zur Watchlist hinzu
   */
  const handleAddToWatchlist = (symbol) => {
    const updated = addToWatchlist(symbol);
    setWatchlist(updated);
  };

  /**
   * Entferne Coin aus Watchlist
   */
  const handleRemoveFromWatchlist = (symbol) => {
    const updated = removeFromWatchlist(symbol);
    setWatchlist(updated);
  };

  /**
   * Request Notification Permission
   */
  const handleRequestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Browser-Notifications werden nicht unterstützt.');
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        const updated = { ...notificationSettings, enabled: true };
        setNotificationSettings(updated);
        saveNotificationSettings(updated);
        
        // Starte Alert Service
        if (updated.backgroundPolling) {
          initAlertService(updated.pollingIntervalMinutes * 60 * 1000);
          setAlertServiceStatus(getAlertStatus());
        }
      }
    } else if (Notification.permission === 'denied') {
      alert('Notifications wurden blockiert. Bitte erlaube Notifications in den Browser-Einstellungen.');
    }
  };

  /**
   * Update Notification Settings
   */
  const handleUpdateNotificationSettings = (key, value) => {
    const updated = {
      ...notificationSettings,
      [key]: value
    };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);

    // Starte/Stoppe Alert Service basierend auf Einstellungen
    if (key === 'enabled' || key === 'backgroundPolling') {
      if (updated.enabled && updated.backgroundPolling && notificationPermission === 'granted') {
        initAlertService(updated.pollingIntervalMinutes * 60 * 1000);
      } else {
        stopAlertService();
      }
      setAlertServiceStatus(getAlertStatus());
    }
  };

  /**
   * Update Signal Notification Setting
   */
  const handleUpdateSignalSetting = (signal, enabled) => {
    const updated = {
      ...notificationSettings,
      signals: {
        ...notificationSettings.signals,
        [signal]: enabled
      }
    };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);
  };

  /**
   * Update Polling Interval
   */
  const handleUpdatePollingInterval = (minutes) => {
    const updated = {
      ...notificationSettings,
      pollingIntervalMinutes: minutes
    };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);
    
    // Restart Alert Service mit neuem Interval
    if (updated.enabled && updated.backgroundPolling && notificationPermission === 'granted') {
      initAlertService(minutes * 60 * 1000);
      setAlertServiceStatus(getAlertStatus());
    }
  };

  /**
   * Filter Coins basierend auf Suchanfrage
   */
  const filteredCoins = availableCoins.filter(coin =>
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.fullSymbol?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Einstellungen...</div>
      </div>
    );
  }

  // Signal-Typen Konfiguration
  const legacySignals = [
    { key: 'STRONG_BUY', label: 'Strong Buy', description: 'Sehr starke Kauf-Empfehlung', icon: '🟢' },
    { key: 'BUY', label: 'Buy', description: 'Kauf-Empfehlung', icon: '🟡' },
    { key: 'HOLD', label: 'Hold', description: 'Halten', icon: '⏸️' },
    { key: 'SELL', label: 'Sell', description: 'Verkauf-Empfehlung', icon: '🟠' },
    { key: 'STRONG_SELL', label: 'Strong Sell', description: 'Sehr starke Verkauf-Empfehlung', icon: '🔴' }
  ];

  const enhancedSignals = [
    { key: 'PULLBACK', label: 'Pullback Alert', description: 'RSI fällt unter 50 bei bullischem Trend - idealer Einstiegspunkt', icon: '🎯' },
    { key: 'ENTRY_QUALITY', label: 'Entry Quality', description: 'Entry Quality springt auf >60 - guter Zeitpunkt zum Einsteigen', icon: '✅' },
    { key: 'OVERHEAT', label: 'Überhitzung', description: 'Neue High-Severity Warnung (RSI >75, schnelle Moves)', icon: '⚠️' },
    { key: 'MULTI_TF_ALIGNMENT', label: 'Multi-TF Alignment', description: 'Alle Timeframes (1h, 4h, 1d) werden bullish', icon: '📊' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold coin-symbol mb-2">Einstellungen</h2>
        <p className="text-gray-400 text-sm">
          Verwalte deine Watchlist und Notification-Einstellungen
        </p>
      </div>

      {/* Alert Service Status */}
      {alertServiceStatus && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${alertServiceStatus.isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <div>
                <span className="font-semibold">Alert Service</span>
                <span className="text-gray-400 text-sm ml-2">
                  {alertServiceStatus.isRunning 
                    ? `Aktiv (${alertServiceStatus.watchedCoins.length} Coins überwacht)` 
                    : 'Inaktiv'}
                </span>
              </div>
            </div>
            {alertServiceStatus.isRunning && (
              <span className="text-xs text-gray-500">
                Polling alle {notificationSettings?.pollingIntervalMinutes || 5} Min.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Watchlist Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Watchlist</h3>
        <p className="text-gray-400 text-sm mb-4">
          Füge Coins zu deiner Watchlist hinzu, um sie auf dem Dashboard zu sehen und Alerts zu erhalten
        </p>

        {/* Current Watchlist */}
        {watchlist.length > 0 ? (
          <div className="mb-6">
            <h4 className="text-md font-semibold mb-3 text-gray-300">Deine Watchlist ({watchlist.length})</h4>
            <div className="flex flex-wrap gap-2">
              {watchlist.map((symbol) => {
                const coin = availableCoins.find(c => c.symbol === symbol);
                return (
                  <div
                    key={symbol}
                    className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-2"
                  >
                    <span
                      className="coin-symbol font-semibold cursor-pointer hover:text-gray-200 transition"
                      onClick={() => onSymbolSelect && onSymbolSelect(symbol)}
                    >
                      {symbol}
                    </span>
                    {coin && (
                      <span className="text-gray-500 text-sm">
                        ${coin.price >= 1 ? coin.price.toFixed(2) : coin.price.toFixed(6)}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveFromWatchlist(symbol)}
                      className="text-gray-500 hover:text-gray-300 transition ml-2"
                      title="Aus Watchlist entfernen"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-gray-500 text-sm">
            Deine Watchlist ist leer. Füge Coins hinzu, um sie zu beobachten und Alerts zu erhalten.
          </div>
        )}

        {/* Add to Watchlist */}
        <div>
          <h4 className="text-md font-semibold mb-3 text-gray-300">Coins hinzufügen</h4>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Suche nach Coin (z.B. BTC, Ethereum)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCoins.length > 0 ? (
              <div className="space-y-2">
                {filteredCoins.map((coin) => {
                  const isInWatchlist = watchlist.includes(coin.symbol);
                  return (
                    <div
                      key={coin.symbol}
                      className="flex items-center justify-between bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="coin-symbol font-semibold cursor-pointer hover:text-gray-200 transition"
                          onClick={() => onSymbolSelect && onSymbolSelect(coin.symbol)}
                        >
                          {coin.symbol}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {coin.price >= 1
                            ? `$${coin.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${coin.price.toFixed(6)}`}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          coin.change24h >= 0 ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'
                        }`}>
                          {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                        </span>
                      </div>
                      <button
                        onClick={() => isInWatchlist ? handleRemoveFromWatchlist(coin.symbol) : handleAddToWatchlist(coin.symbol)}
                        className={`px-4 py-1 rounded text-sm font-semibold transition ${
                          isInWatchlist
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                        }`}
                      >
                        {isInWatchlist ? 'Entfernen' : 'Hinzufügen'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-gray-500 text-sm text-center py-4">
                Keine Coins gefunden
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Settings Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Notification-Einstellungen</h3>
        
        {/* Permission Status */}
        <div className="mb-6 p-4 bg-gray-900 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-1">Browser-Notifications</h4>
              <p className="text-gray-400 text-sm">
                Status: {notificationPermission === 'granted' ? '✅ Aktiviert' : notificationPermission === 'denied' ? '❌ Blockiert' : '⚠️ Nicht erlaubt'}
              </p>
            </div>
            {notificationPermission !== 'granted' && (
              <button
                onClick={handleRequestNotificationPermission}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition"
                disabled={notificationPermission === 'denied'}
              >
                {notificationPermission === 'denied' ? 'Blockiert' : 'Erlauben'}
              </button>
            )}
          </div>
          {notificationPermission === 'denied' && (
            <p className="text-gray-500 text-xs mt-2">
              ⚠️ Notifications wurden blockiert. Bitte in den Browser-Einstellungen erlauben.
            </p>
          )}
        </div>

        {/* Global Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationSettings?.enabled && notificationPermission === 'granted'}
              onChange={(e) => handleUpdateNotificationSettings('enabled', e.target.checked)}
              disabled={notificationPermission !== 'granted'}
              className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-300 font-semibold">Notifications aktivieren</span>
          </label>
        </div>

        {/* Background Polling Toggle */}
        <div className="mb-6 p-4 bg-gray-900 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={notificationSettings?.backgroundPolling !== false}
              onChange={(e) => handleUpdateNotificationSettings('backgroundPolling', e.target.checked)}
              disabled={!notificationSettings?.enabled || notificationPermission !== 'granted'}
              className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-gray-300 font-semibold block">Background-Überwachung</span>
              <span className="text-gray-500 text-sm">Watchlist automatisch im Hintergrund prüfen</span>
            </div>
          </label>
          
          {notificationSettings?.backgroundPolling && (
            <div className="ml-8">
              <label className="text-gray-400 text-sm block mb-2">Prüf-Intervall:</label>
              <select
                value={notificationSettings?.pollingIntervalMinutes || 5}
                onChange={(e) => handleUpdatePollingInterval(parseInt(e.target.value))}
                disabled={!notificationSettings?.enabled || notificationPermission !== 'granted'}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
              >
                <option value={2}>Alle 2 Minuten</option>
                <option value={5}>Alle 5 Minuten</option>
                <option value={10}>Alle 10 Minuten</option>
                <option value={15}>Alle 15 Minuten</option>
                <option value={30}>Alle 30 Minuten</option>
              </select>
            </div>
          )}
        </div>

        {/* Enhanced Signal Types - NEU */}
        {notificationSettings && (
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <span>🎯</span> Entry-Timing Alerts
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">NEU</span>
              </h4>
              <p className="text-gray-400 text-sm mb-4">
                Werde benachrichtigt wenn ein guter Einstiegspunkt erkannt wird
              </p>
              
              <div className="space-y-3">
                {enhancedSignals.map((signal) => (
                  <label key={signal.key} className="flex items-start gap-3 cursor-pointer p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition">
                    <input
                      type="checkbox"
                      checked={notificationSettings.signals?.[signal.key] !== false}
                      onChange={(e) => handleUpdateSignalSetting(signal.key, e.target.checked)}
                      disabled={!notificationSettings.enabled || notificationPermission !== 'granted'}
                      className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <span className="text-gray-300 font-semibold block">
                        {signal.icon} {signal.label}
                      </span>
                      <span className="text-gray-500 text-sm">{signal.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-md font-semibold text-gray-300 mb-2">Signal-Typen (klassisch)</h4>
              <p className="text-gray-400 text-sm mb-4">
                Wähle für welche Signal-Typen du Notifications erhalten möchtest
              </p>
              
              <div className="space-y-3">
                {legacySignals.map((signal) => (
                  <label key={signal.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.signals?.[signal.key] || false}
                      onChange={(e) => handleUpdateSignalSetting(signal.key, e.target.checked)}
                      disabled={!notificationSettings.enabled || notificationPermission !== 'granted'}
                      className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                      <span className="text-gray-300 font-semibold block">
                        {signal.icon} {signal.label}
                      </span>
                      <span className="text-gray-500 text-sm">{signal.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Additional Settings */}
        {notificationSettings && (
          <div className="mt-6 space-y-4 border-t border-gray-700 pt-6">
            <h4 className="text-md font-semibold text-gray-300">Weitere Einstellungen</h4>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.portfolioSellAlerts || false}
                onChange={(e) => handleUpdateNotificationSettings('portfolioSellAlerts', e.target.checked)}
                disabled={!notificationSettings.enabled || notificationPermission !== 'granted'}
                className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-gray-300 font-semibold block">Portfolio Sell-Alerts</span>
                <span className="text-gray-500 text-sm">Benachrichtigungen wenn Portfolio-Coins Sell-Signal zeigen</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.watchlistAlerts || false}
                onChange={(e) => handleUpdateNotificationSettings('watchlistAlerts', e.target.checked)}
                disabled={!notificationSettings.enabled || notificationPermission !== 'granted'}
                className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-gray-300 font-semibold block">Watchlist Alerts</span>
                <span className="text-gray-500 text-sm">Benachrichtigungen für alle Coins in der Watchlist</span>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
