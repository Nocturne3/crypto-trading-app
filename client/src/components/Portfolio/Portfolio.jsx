import { useState, useEffect } from 'react';
import { getTop50Prices, getAnalysis, getCoinPrice } from '../../services/api';
import { 
  loadPortfolio, 
  removeFromPortfolio, 
  calculatePortfolioValue, 
  addToPortfolio,
  loadPortfolioAlerts,
  savePortfolioAlerts,
  setPortfolioAlert,
  removePortfolioAlert,
  getPortfolioAlert
} from '../../utils/storage';
import { usePolling } from '../../hooks/usePolling';
import PortfolioTracking from './PortfolioTracking';

/**
 * Portfolio Komponente
 * 
 * Zeigt das Portfolio des Benutzers an mit:
 * - Liste aller Coins im Portfolio
 * - Einkaufspreis vs. Aktueller Preis
 * - Gewinn/Verlust pro Coin
 * - Gesamtportfolio-Wert
 * - Gesamtgewinn/Verlust
 * - Buy/Sell-Empfehlungen basierend auf technischer Analyse
 * - Stop-Loss-Empfehlungen basierend auf Einkaufspreis und ATR
 * 
 * Features:
 * - Automatisches Polling für aktuelle Preise und Analysen
 * - Remove-Funktion für Coins
 * - Farbcodierung für Gewinn/Verlust
 * - Stop-Loss Warnung wenn getriggert
 * 
 * Props:
 * - onSymbolSelect: Callback wenn Symbol angeklickt wird (für Detail-Ansicht)
 */
export default function Portfolio({ onSymbolSelect }) {
  const [portfolio, setPortfolio] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({});
  const [portfolioValue, setPortfolioValue] = useState(null);
  const [analyses, setAnalyses] = useState({}); // Symbol -> Analysis Mapping
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview'); // 'overview' | 'tracking'
  const [previousRecommendations, setPreviousRecommendations] = useState({}); // Track previous recommendations
  const [previousProfitPercentages, setPreviousProfitPercentages] = useState({}); // Track previous profit percentages for alerts
  const [notificationPermission, setNotificationPermission] = useState('default'); // 'default', 'granted', 'denied'
  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // User preference
  const [showAddCoinForm, setShowAddCoinForm] = useState(false);
  const [newCoin, setNewCoin] = useState({
    symbol: '',
    amount: '',
    buyPrice: ''
  });
  const [addingCoin, setAddingCoin] = useState(false);
  const [portfolioAlerts, setPortfolioAlerts] = useState({}); // Alert configurations
  const [editingAlert, setEditingAlert] = useState(null); // Symbol being edited
  const [alertForm, setAlertForm] = useState({
    profitThreshold: '',
    lossThreshold: '',
    enabled: true
  });

  /**
   * Lade Portfolio und aktuelle Preise
   */
  const fetchData = async () => {
    try {
      // Lade Portfolio aus LocalStorage
      const portfolioData = loadPortfolio();
      setPortfolio(portfolioData);

      if (portfolioData.length === 0) {
        setLoading(false);
        return;
      }

      // Hole aktuelle Preise für alle Coins im Portfolio
      const pricesData = await getTop50Prices();
      const priceMap = {};
      pricesData.forEach(coin => {
        priceMap[coin.symbol] = coin.price;
      });

      // Für Coins die nicht in Top 50 sind, versuche Preis einzeln zu holen
      const missingSymbols = portfolioData.filter(item => !priceMap[item.symbol]);
      if (missingSymbols.length > 0) {
        const pricePromises = missingSymbols.map(async (item) => {
          try {
            const coinData = await getCoinPrice(item.symbol);
            return { symbol: item.symbol, price: coinData.price };
          } catch (err) {
            console.warn(`Could not fetch price for ${item.symbol}:`, err);
            return { symbol: item.symbol, price: null };
          }
        });

        const missingPrices = await Promise.all(pricePromises);
        missingPrices.forEach(({ symbol, price }) => {
          if (price !== null) {
            priceMap[symbol] = price;
          }
        });
      }

      setCurrentPrices(priceMap);

      // Berechne Portfolio-Wert
      const value = calculatePortfolioValue(portfolioData, priceMap);
      setPortfolioValue(value);

      // Hole Analysis-Daten für alle Coins im Portfolio (parallel)
      const analysisPromises = portfolioData.map(async (item) => {
        try {
          const analysis = await getAnalysis(item.symbol, '1h');
          return { symbol: item.symbol, analysis };
        } catch (err) {
          console.error(`Error analyzing ${item.symbol}:`, err);
          return { symbol: item.symbol, analysis: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      const analysisMap = {};
      const currentRecommendations = {};
      
      analysisResults.forEach(({ symbol, analysis }) => {
        analysisMap[symbol] = analysis;
        // Track current recommendations for comparison
        if (analysis?.recommendations?.recommendation) {
          currentRecommendations[symbol] = analysis.recommendations.recommendation;
        }
      });
      
      // Check for sell recommendations and price alerts before updating state
      if (notificationsEnabled && notificationPermission === 'granted' && 'Notification' in window) {
        // Check sell recommendations
        Object.keys(currentRecommendations).forEach(symbol => {
          const currentRec = currentRecommendations[symbol];
          const previousRec = previousRecommendations[symbol];
          
          // Notify if recommendation changed to SELL or STRONG_SELL
          // Only notify if there was a previous recommendation (not on first load)
          if (previousRec && 
              (currentRec === 'SELL' || currentRec === 'STRONG_SELL') && 
              previousRec !== 'SELL' && 
              previousRec !== 'STRONG_SELL') {
            
            const item = portfolioValue?.items.find(i => i.symbol === symbol);
            if (item) {
              const score = analysisMap[symbol]?.recommendations?.score;
              const notificationTitle = `${symbol} - ${currentRec === 'STRONG_SELL' ? 'Strong Sell' : 'Sell'} Empfehlung`;
              const notificationBody = `Aktueller Preis: ${formatPrice(item.currentPrice)}\nGewinn/Verlust: ${formatPercent(item.profitPercent)}\nScore: ${score?.toFixed(1) || 'N/A'}`;
              
              try {
                new Notification(notificationTitle, {
                  body: notificationBody,
                  icon: '/vite.svg',
                  badge: '/vite.svg',
                  tag: `sell-${symbol}-${Date.now()}`,
                  requireInteraction: false,
                  silent: false
                });
              } catch (error) {
                console.error('Error showing notification:', error);
              }
            }
          }
        });

        // Check price alerts
        portfolioValue?.items.forEach(item => {
          if (!item.hasCurrentPrice) return; // Skip if no current price available
          
          const alertConfig = portfolioAlerts[item.symbol];
          if (!alertConfig || !alertConfig.enabled) return;

          const currentProfitPercent = item.profitPercent;
          const previousProfitPercent = previousProfitPercentages[item.symbol];

          // Check profit threshold (positive alert)
          if (alertConfig.profitThreshold !== null && alertConfig.profitThreshold !== undefined) {
            const threshold = parseFloat(alertConfig.profitThreshold);
            // Only check if we have a previous value (not on first load)
            if (previousProfitPercent !== undefined) {
              const wasBelowThreshold = previousProfitPercent < threshold;
              const isAboveThreshold = currentProfitPercent >= threshold;

              // Trigger if crossing threshold upward
              if (wasBelowThreshold && isAboveThreshold) {
                const notificationTitle = `🎉 ${item.symbol} - Gewinn-Ziel erreicht!`;
                const notificationBody = `Gewinn: ${formatPercent(currentProfitPercent)}\nZiel: +${threshold.toFixed(2)}%\nAktueller Preis: ${formatPrice(item.currentPrice)}`;
                
                try {
                  new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: '/vite.svg',
                    badge: '/vite.svg',
                    tag: `profit-alert-${item.symbol}-${threshold}`,
                    requireInteraction: false,
                    silent: false
                  });
                } catch (error) {
                  console.error('Error showing notification:', error);
                }
              }
            }
          }

          // Check loss threshold (negative alert)
          if (alertConfig.lossThreshold !== null && alertConfig.lossThreshold !== undefined) {
            const threshold = parseFloat(alertConfig.lossThreshold);
            // Only check if we have a previous value (not on first load)
            if (previousProfitPercent !== undefined) {
              const wasAboveThreshold = previousProfitPercent > threshold;
              const isBelowThreshold = currentProfitPercent <= threshold;

              // Trigger if crossing threshold downward
              if (wasAboveThreshold && isBelowThreshold) {
                const notificationTitle = `⚠️ ${item.symbol} - Verlust-Warnung!`;
                const notificationBody = `Verlust: ${formatPercent(currentProfitPercent)}\nSchwelle: ${threshold.toFixed(2)}%\nAktueller Preis: ${formatPrice(item.currentPrice)}`;
                
                try {
                  new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: '/vite.svg',
                    badge: '/vite.svg',
                    tag: `loss-alert-${item.symbol}-${threshold}`,
                    requireInteraction: false,
                    silent: false
                  });
                } catch (error) {
                  console.error('Error showing notification:', error);
                }
              }
            }
          }
        });
      }

      // Update previous profit percentages for next comparison
      const currentProfitPercentages = {};
      portfolioValue?.items.forEach(item => {
        if (item.hasCurrentPrice) {
          currentProfitPercentages[item.symbol] = item.profitPercent;
        }
      });
      setPreviousProfitPercentages(prev => ({ ...prev, ...currentProfitPercentages }));
      
      // Update analyses and previous recommendations
      setAnalyses(analysisMap);
      setPreviousRecommendations(prev => {
        // Update with current recommendations, keeping previous for symbols that no longer exist
        return { ...prev, ...currentRecommendations };
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setLoading(false);
    }
  };

  /**
   * Request notification permission
   */
  useEffect(() => {
    if ('Notification' in window) {
      // Check current permission
      setNotificationPermission(Notification.permission);
      
      // Request permission if not already granted or denied
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
          // Save preference to localStorage
          localStorage.setItem('portfolio_notifications_enabled', permission === 'granted' ? 'true' : 'false');
          setNotificationsEnabled(permission === 'granted');
        });
      } else {
        // Load saved preference
        const saved = localStorage.getItem('portfolio_notifications_enabled');
        setNotificationsEnabled(saved !== 'false' && Notification.permission === 'granted');
      }
    }
  }, []);


  // Load portfolio alerts on mount
  useEffect(() => {
    const alerts = loadPortfolioAlerts();
    setPortfolioAlerts(alerts);
  }, []);

  // Initial Load
  useEffect(() => {
    fetchData();
  }, []);

  // Polling alle 2 Minuten
  usePolling(fetchData, 120000);

  /**
   * Entferne Coin aus Portfolio
   */
  const handleRemove = (symbol) => {
    if (window.confirm(`Möchtest du ${symbol} wirklich aus dem Portfolio entfernen?`)) {
      removeFromPortfolio(symbol);
      fetchData(); // Aktualisiere Anzeige
    }
  };

  /**
   * Füge Coin manuell zum Portfolio hinzu
   */
  const handleAddCoin = async () => {
    if (!newCoin.symbol || !newCoin.amount || !newCoin.buyPrice) {
      alert('Bitte fülle alle Felder aus');
      return;
    }

    const symbol = newCoin.symbol.toUpperCase().trim();
    const amount = parseFloat(newCoin.amount);
    const buyPrice = parseFloat(newCoin.buyPrice);

    if (isNaN(amount) || amount <= 0) {
      alert('Bitte gib eine gültige Menge ein');
      return;
    }

    if (isNaN(buyPrice) || buyPrice <= 0) {
      alert('Bitte gib einen gültigen Einkaufspreis ein');
      return;
    }

    setAddingCoin(true);
    try {
      // Füge Coin zum Portfolio hinzu
      addToPortfolio(symbol, amount, buyPrice);
      
      // Reset Form
      setNewCoin({
        symbol: '',
        amount: '',
        buyPrice: ''
      });
      setShowAddCoinForm(false);
      
      // Aktualisiere Portfolio-Anzeige
      await fetchData();
    } catch (error) {
      console.error('Error adding coin:', error);
      alert('Fehler beim Hinzufügen des Coins. Bitte versuche es erneut.');
    } finally {
      setAddingCoin(false);
    }
  };

  /**
   * Versuche aktuellen Preis für Symbol zu holen (für Vorschau)
   */
  const handleFetchCurrentPrice = async () => {
    if (!newCoin.symbol) {
      return;
    }

    try {
      const coinData = await getCoinPrice(newCoin.symbol.toUpperCase().trim());
      setNewCoin({
        ...newCoin,
        buyPrice: coinData.price.toString()
      });
    } catch (error) {
      console.warn('Could not fetch current price:', error);
      // Don't show error, user can still enter price manually
    }
  };

  /**
   * Öffne Alert-Konfiguration für einen Coin
   */
  const handleOpenAlertConfig = (symbol) => {
    const existingAlert = portfolioAlerts[symbol] || { profitThreshold: null, lossThreshold: null, enabled: true };
    setAlertForm({
      profitThreshold: existingAlert.profitThreshold !== null ? existingAlert.profitThreshold.toString() : '',
      lossThreshold: existingAlert.lossThreshold !== null ? existingAlert.lossThreshold.toString() : '',
      enabled: existingAlert.enabled !== false
    });
    setEditingAlert(symbol);
  };

  /**
   * Speichere Alert-Konfiguration
   */
  const handleSaveAlert = (symbol) => {
    const alertConfig = {
      profitThreshold: alertForm.profitThreshold ? parseFloat(alertForm.profitThreshold) : null,
      lossThreshold: alertForm.lossThreshold ? parseFloat(alertForm.lossThreshold) : null,
      enabled: alertForm.enabled
    };

    const updatedAlerts = setPortfolioAlert(symbol, alertConfig);
    setPortfolioAlerts(updatedAlerts);
    setEditingAlert(null);
    setAlertForm({ profitThreshold: '', lossThreshold: '', enabled: true });
  };

  /**
   * Entferne Alert-Konfiguration
   */
  const handleRemoveAlert = (symbol) => {
    const updatedAlerts = removePortfolioAlert(symbol);
    setPortfolioAlerts(updatedAlerts);
    setEditingAlert(null);
  };

  /**
   * Formatiere Preis
   */
  const formatPrice = (price) => {
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  /**
   * Formatiere Prozent
   */
  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  /**
   * Berechne Stop-Loss basierend auf Einkaufspreis
   * 
   * @param {number} buyPrice - Einkaufspreis
   * @param {number} currentPrice - Aktueller Preis
   * @param {Object} stopLossData - Stop-Loss Daten aus Analysis
   * @returns {Object} { stopLoss, stopLossPercent, isTriggered }
   */
  const calculatePortfolioStopLoss = (buyPrice, currentPrice, stopLossData) => {
    if (!stopLossData || !stopLossData.atr || !currentPrice) {
      return null;
    }

    // Stop-Loss für Long-Position: Einkaufspreis - (2 * ATR)
    // Dies schützt vor Verlusten, wenn der Preis unter den Stop-Loss fällt
    const stopLoss = buyPrice - (2 * stopLossData.atr);
    const stopLossPercent = ((buyPrice - stopLoss) / buyPrice) * 100;
    const isTriggered = currentPrice <= stopLoss;

    return {
      stopLoss,
      stopLossPercent,
      isTriggered,
      distanceToStopLoss: ((currentPrice - stopLoss) / currentPrice) * 100
    };
  };

  /**
   * Hole Recommendation für einen Coin
   */
  const getRecommendation = (symbol) => {
    return analyses[symbol]?.recommendations?.recommendation || null;
  };

  /**
   * Hole Score für einen Coin
   */
  const getScore = (symbol) => {
    return analyses[symbol]?.recommendations?.score || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Portfolio...</div>
      </div>
    );
  }

  if (portfolio.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-400 text-lg mb-2">Portfolio ist leer</div>
        <div className="text-gray-500 text-sm">
          Füge Coins über die Crypto Table hinzu
        </div>
      </div>
    );
  }

  /**
   * Toggle notification settings
   */
  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Browser-Notifications werden nicht unterstützt.');
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === 'granted');
      localStorage.setItem('portfolio_notifications_enabled', permission === 'granted' ? 'true' : 'false');
    } else if (Notification.permission === 'denied') {
      alert('Notifications wurden blockiert. Bitte erlaube Notifications in den Browser-Einstellungen.');
    } else {
      // Toggle enabled state
      const newState = !notificationsEnabled;
      setNotificationsEnabled(newState);
      localStorage.setItem('portfolio_notifications_enabled', newState ? 'true' : 'false');
    }
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveView('overview')}
          className={`px-4 py-2 font-semibold transition ${
            activeView === 'overview'
              ? 'text-white border-b-2 border-gray-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Übersicht
        </button>
        <button
          onClick={() => setActiveView('tracking')}
          className={`px-4 py-2 font-semibold transition ${
            activeView === 'tracking'
              ? 'text-white border-b-2 border-gray-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Tracking & Statistiken
        </button>
      </div>

      {activeView === 'tracking' ? (
        <PortfolioTracking />
      ) : (
        <>
      {/* Add Coin Form */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold coin-symbol">Coin zum Portfolio hinzufügen</h3>
          <button
            onClick={() => setShowAddCoinForm(!showAddCoinForm)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
          >
            {showAddCoinForm ? 'Abbrechen' : '+ Coin hinzufügen'}
          </button>
        </div>

        {showAddCoinForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Symbol</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCoin.symbol}
                  onChange={(e) => setNewCoin({ ...newCoin, symbol: e.target.value })}
                  placeholder="BTC"
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                  onBlur={handleFetchCurrentPrice}
                />
                <button
                  onClick={handleFetchCurrentPrice}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
                  title="Aktuellen Preis holen"
                >
                  🔍
                </button>
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Menge</label>
              <input
                type="number"
                value={newCoin.amount}
                onChange={(e) => setNewCoin({ ...newCoin, amount: e.target.value })}
                placeholder="0.1"
                step="0.000001"
                min="0"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Einkaufspreis (USD)</label>
              <input
                type="number"
                value={newCoin.buyPrice}
                onChange={(e) => setNewCoin({ ...newCoin, buyPrice: e.target.value })}
                placeholder="50000"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddCoin}
                disabled={addingCoin}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCoin ? 'Hinzufügen...' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Browser-Notifications</h3>
          <p className="text-gray-400 text-sm">
            Erhalte Benachrichtigungen bei Sell-Empfehlungen und konfigurierbaren Preis-Alerts (Gewinn/Verlust-Schwellen)
          </p>
          {notificationPermission === 'denied' && (
            <p className="text-gray-500 text-xs mt-1">
              ⚠️ Notifications wurden blockiert. Bitte in den Browser-Einstellungen erlauben.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {notificationsEnabled && notificationPermission === 'granted' ? 'Aktiviert' : 'Deaktiviert'}
          </span>
          <button
            onClick={handleToggleNotifications}
            className={`px-4 py-2 rounded text-sm font-semibold transition ${
              notificationsEnabled && notificationPermission === 'granted'
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
            disabled={notificationPermission === 'denied'}
          >
            {notificationsEnabled && notificationPermission === 'granted' ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      {portfolioValue && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Portfolio Übersicht</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-gray-400 text-sm">Gesamtwert</div>
              <div className="text-xl font-semibold">
                {formatPrice(portfolioValue.totalValue)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Gesamtkosten</div>
              <div className="text-xl font-semibold">
                {formatPrice(portfolioValue.totalCost)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Gewinn/Verlust</div>
              <div className={`text-xl font-semibold ${
                portfolioValue.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPrice(portfolioValue.totalProfit)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Gewinn/Verlust %</div>
              <div className={`text-xl font-semibold ${
                portfolioValue.totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPercent(portfolioValue.totalProfitPercent)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Items */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left p-3 text-gray-400 font-semibold">Symbol</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Menge</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Einkaufspreis</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Aktueller Preis</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Wert</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Gewinn/Verlust</th>
              <th className="text-right p-3 text-gray-400 font-semibold">G/V %</th>
              <th className="text-center p-3 text-gray-400 font-semibold">Empfehlung</th>
              <th className="text-right p-3 text-gray-400 font-semibold">Stop-Loss</th>
              <th className="text-center p-3 text-gray-400 font-semibold">Alerts</th>
              <th className="text-center p-3 text-gray-400 font-semibold">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {portfolioValue?.items.map((item) => {
              const profitColor = item.profit >= 0 ? 'text-green-400' : 'text-red-400';
              const profitBgColor = item.profit >= 0 ? 'bg-green-900/20' : 'bg-red-900/20';
              
              // Hole Analysis-Daten für diesen Coin
              const analysis = analyses[item.symbol];
              const recommendation = getRecommendation(item.symbol);
              const score = getScore(item.symbol);
              const stopLossData = analysis?.recommendations?.stopLoss;
              
              // Berechne Stop-Loss basierend auf Einkaufspreis
              const portfolioStopLoss = stopLossData 
                ? calculatePortfolioStopLoss(item.buyPrice, item.currentPrice, stopLossData)
                : null;

              return (
                <tr 
                  key={item.symbol}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td 
                    className="p-3 coin-symbol cursor-pointer hover:text-gray-200 transition"
                    onClick={() => onSymbolSelect && onSymbolSelect(item.symbol)}
                  >
                    {item.symbol}
                  </td>
                  <td className="p-3 text-right">{item.amount.toFixed(6)}</td>
                  <td className="p-3 text-right text-gray-400">
                    {formatPrice(item.buyPrice)}
                  </td>
                  <td className="p-3 text-right">
                    {item.hasCurrentPrice ? (
                      formatPrice(item.currentPrice)
                    ) : (
                      <span className="text-gray-500 text-sm">
                        {formatPrice(item.buyPrice)} <span className="text-xs">(EK)</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {item.hasCurrentPrice ? (
                      formatPrice(item.value)
                    ) : (
                      <span className="text-gray-500 text-sm">
                        {formatPrice(item.cost)} <span className="text-xs">(geschätzt)</span>
                      </span>
                    )}
                  </td>
                  <td className={`p-3 text-right ${profitColor} font-semibold`}>
                    {item.hasCurrentPrice ? (
                      formatPrice(item.profit)
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </td>
                  <td className={`p-3 text-right ${profitColor} font-semibold ${profitBgColor}`}>
                    {item.hasCurrentPrice ? (
                      formatPercent(item.profitPercent)
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {recommendation ? (
                      <div className="space-y-1">
                        <span className={`px-2 py-1 rounded text-xs font-semibold coin-symbol block ${
                          recommendation === 'STRONG_BUY' ? 'bg-gray-700 text-gray-200' :
                          recommendation === 'BUY' ? 'bg-gray-800 text-gray-300' :
                          recommendation === 'HOLD' ? 'bg-gray-800 text-gray-400' :
                          recommendation === 'SELL' ? 'bg-gray-800 text-gray-500' :
                          'bg-gray-800 text-gray-600'
                        }`}>
                          {recommendation.replace('_', ' ')}
                        </span>
                        {score !== null && (
                          <div className="text-xs text-gray-500 coin-symbol">
                            Score: {score.toFixed(1)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">Berechne...</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {portfolioStopLoss ? (
                      <div className="space-y-1">
                        <div className={`text-sm font-semibold coin-symbol ${
                          portfolioStopLoss.isTriggered ? 'text-gray-500' : 'text-gray-300'
                        }`}>
                          {formatPrice(portfolioStopLoss.stopLoss)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatPercent(portfolioStopLoss.stopLossPercent)} vom EK
                        </div>
                        {portfolioStopLoss.isTriggered ? (
                          <div className="text-xs text-gray-600 font-semibold">
                            ⚠️ Getriggert
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            {formatPercent(portfolioStopLoss.distanceToStopLoss)} entfernt
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {editingAlert === item.symbol ? (
                      <div className="space-y-2 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400 w-20">Gewinn:</label>
                          <input
                            type="number"
                            value={alertForm.profitThreshold}
                            onChange={(e) => setAlertForm({ ...alertForm, profitThreshold: e.target.value })}
                            placeholder="+10"
                            step="0.1"
                            className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400 w-20">Verlust:</label>
                          <input
                            type="number"
                            value={alertForm.lossThreshold}
                            onChange={(e) => setAlertForm({ ...alertForm, lossThreshold: e.target.value })}
                            placeholder="-5"
                            step="0.1"
                            className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-xs"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={alertForm.enabled}
                            onChange={(e) => setAlertForm({ ...alertForm, enabled: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <label className="text-xs text-gray-400">Aktiviert</label>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveAlert(item.symbol)}
                            className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs transition"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={() => {
                              setEditingAlert(null);
                              setAlertForm({ profitThreshold: '', lossThreshold: '', enabled: true });
                            }}
                            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs transition"
                          >
                            Abbrechen
                          </button>
                        </div>
                        {portfolioAlerts[item.symbol] && (
                          <button
                            onClick={() => handleRemoveAlert(item.symbol)}
                            className="w-full px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs transition"
                          >
                            Alert entfernen
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {portfolioAlerts[item.symbol] && portfolioAlerts[item.symbol].enabled ? (
                          <div className="text-xs space-y-0.5">
                            {portfolioAlerts[item.symbol].profitThreshold !== null && (
                              <div className="text-green-400">
                                🎯 +{portfolioAlerts[item.symbol].profitThreshold.toFixed(1)}%
                              </div>
                            )}
                            {portfolioAlerts[item.symbol].lossThreshold !== null && (
                              <div className="text-red-400">
                                ⚠️ {portfolioAlerts[item.symbol].lossThreshold.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                        <button
                          onClick={() => handleOpenAlertConfig(item.symbol)}
                          className="mt-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs transition"
                        >
                          {portfolioAlerts[item.symbol] ? 'Bearbeiten' : 'Alert'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleRemove(item.symbol)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

