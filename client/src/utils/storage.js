/**
 * LocalStorage Utility für Portfolio-Verwaltung
 * 
 * Diese Funktionen verwalten das Portfolio im Browser-LocalStorage.
 * Das Portfolio wird als JSON gespeichert und enthält:
 * - Array von Portfolio-Items mit Symbol, Menge, Einkaufspreis
 */

const PORTFOLIO_STORAGE_KEY = 'crypto_portfolio';

/**
 * Lade Portfolio aus LocalStorage
 * 
 * @returns {Array} Array von Portfolio-Items
 * {
 *   symbol: string,
 *   amount: number,
 *   buyPrice: number,
 *   addedAt: string (ISO Date)
 * }
 */
export function loadPortfolio() {
  try {
    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading portfolio:', error);
    return [];
  }
}

/**
 * Speichere Portfolio in LocalStorage
 * 
 * @param {Array} portfolio - Array von Portfolio-Items
 */
export function savePortfolio(portfolio) {
  try {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));
  } catch (error) {
    console.error('Error saving portfolio:', error);
  }
}

/**
 * Füge Coin zum Portfolio hinzu
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 * @param {number} amount - Menge
 * @param {number} buyPrice - Einkaufspreis
 * @returns {Array} Aktualisiertes Portfolio
 */
export function addToPortfolio(symbol, amount, buyPrice) {
  const portfolio = loadPortfolio();
  
  // Prüfe ob Coin bereits im Portfolio ist
  const existingIndex = portfolio.findIndex(item => item.symbol === symbol);
  
  if (existingIndex >= 0) {
    // Coin existiert bereits - aktualisiere Menge und Durchschnittspreis
    const existing = portfolio[existingIndex];
    const totalAmount = existing.amount + amount;
    const totalValue = (existing.amount * existing.buyPrice) + (amount * buyPrice);
    const averagePrice = totalValue / totalAmount;
    
    portfolio[existingIndex] = {
      ...existing,
      amount: totalAmount,
      buyPrice: averagePrice
    };
  } else {
    // Neuer Coin - füge hinzu
    portfolio.push({
      symbol,
      amount,
      buyPrice,
      addedAt: new Date().toISOString()
    });
  }
  
  savePortfolio(portfolio);
  
  // Erstelle BUY Trade-Event für Historie
  import('./tradeHistory.js').then(({ addTradeToHistory }) => {
    addTradeToHistory({
      type: 'BUY',
      symbol,
      amount,
      price: buyPrice,
      totalValue: amount * buyPrice,
      notes: 'Portfolio hinzugefügt'
    });
  });
  
  return portfolio;
}

/**
 * Entferne Coin aus Portfolio
 * 
 * @param {string} symbol - Crypto Symbol
 * @returns {Array} Aktualisiertes Portfolio
 */
export function removeFromPortfolio(symbol) {
  const portfolio = loadPortfolio();
  const item = portfolio.find(p => p.symbol === symbol);
  const filtered = portfolio.filter(item => item.symbol !== symbol);
  savePortfolio(filtered);
  
  // Erstelle SELL Trade-Event für Historie
  if (item) {
    import('./tradeHistory.js').then(({ addTradeToHistory }) => {
      addTradeToHistory({
        type: 'SELL',
        symbol: item.symbol,
        amount: item.amount,
        price: item.buyPrice, // Verwende Einkaufspreis als Referenz
        totalValue: item.amount * item.buyPrice,
        notes: 'Portfolio entfernt'
      });
    });
  }
  
  return filtered;
}

/**
 * Aktualisiere Portfolio-Item
 * 
 * @param {string} symbol - Crypto Symbol
 * @param {Object} updates - Zu aktualisierende Felder {amount?, buyPrice?}
 * @returns {Array} Aktualisiertes Portfolio
 */
export function updatePortfolioItem(symbol, updates) {
  const portfolio = loadPortfolio();
  const index = portfolio.findIndex(item => item.symbol === symbol);
  
  if (index >= 0) {
    portfolio[index] = {
      ...portfolio[index],
      ...updates
    };
    savePortfolio(portfolio);
  }
  
  return portfolio;
}

/**
 * Berechne Portfolio-Wert basierend auf aktuellen Preisen
 * 
 * @param {Array} portfolio - Portfolio Array
 * @param {Object} currentPrices - Objekt mit Symbol -> Preis Mapping
 * @returns {Object} {
 *   totalValue: number,
 *   totalCost: number,
 *   totalProfit: number,
 *   totalProfitPercent: number,
 *   items: Array mit Gewinn/Verlust pro Item
 * }
 */
export function calculatePortfolioValue(portfolio, currentPrices) {
  let totalCost = 0;
  let totalValue = 0;
  const items = [];

  portfolio.forEach(item => {
    // Verwende aktuellen Preis wenn verfügbar, sonst Einkaufspreis als Fallback
    const currentPrice = currentPrices[item.symbol] !== undefined && currentPrices[item.symbol] !== null
      ? currentPrices[item.symbol]
      : item.buyPrice; // Fallback auf Einkaufspreis wenn kein aktueller Preis verfügbar
    const hasCurrentPrice = currentPrices[item.symbol] !== undefined && currentPrices[item.symbol] !== null;
    
    const cost = item.amount * item.buyPrice;
    const value = item.amount * currentPrice;
    const profit = value - cost;
    const profitPercent = item.buyPrice > 0 
      ? ((currentPrice - item.buyPrice) / item.buyPrice) * 100 
      : 0;

    totalCost += cost;
    totalValue += value;

    items.push({
      ...item,
      currentPrice,
      hasCurrentPrice, // Flag ob aktueller Preis verfügbar ist
      cost,
      value,
      profit,
      profitPercent
    });
  });

  const totalProfit = totalValue - totalCost;
  const totalProfitPercent = totalCost > 0 
    ? (totalProfit / totalCost) * 100 
    : 0;

  return {
    totalCost,
    totalValue,
    totalProfit,
    totalProfitPercent,
    items
  };
}

/**
 * Trading Capital Verwaltung
 */

const TRADING_CAPITAL_STORAGE_KEY = 'crypto_trading_capital';

/**
 * Lade Trading Capital aus LocalStorage
 * 
 * @returns {number} Verfügbares Trading-Vermögen in USD
 */
export function getTradingCapital() {
  try {
    const stored = localStorage.getItem(TRADING_CAPITAL_STORAGE_KEY);
    if (!stored) {
      return 0;
    }
    return parseFloat(stored) || 0;
  } catch (error) {
    console.error('Error loading trading capital:', error);
    return 0;
  }
}

/**
 * Speichere Trading Capital in LocalStorage
 * 
 * @param {number} capital - Verfügbares Trading-Vermögen in USD
 */
export function setTradingCapital(capital) {
  try {
    const value = parseFloat(capital);
    if (isNaN(value) || value < 0) {
      throw new Error('Invalid capital value');
    }
    localStorage.setItem(TRADING_CAPITAL_STORAGE_KEY, value.toString());
  } catch (error) {
    console.error('Error saving trading capital:', error);
  }
}

/**
 * Dashboard Layout Verwaltung
 */

const DASHBOARD_LAYOUT_STORAGE_KEY = 'crypto_dashboard_layout';

/**
 * Lade Dashboard-Layout aus LocalStorage
 * 
 * @returns {Array} Array von Widget-Konfigurationen
 */
export function loadDashboardLayout() {
  try {
    const stored = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading dashboard layout:', error);
    return null;
  }
}

/**
 * Speichere Dashboard-Layout in LocalStorage
 * 
 * @param {Array} layout - Array von Widget-Konfigurationen
 */
export function saveDashboardLayout(layout) {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (error) {
    console.error('Error saving dashboard layout:', error);
  }
}

/**
 * Watchlist Verwaltung
 */

const WATCHLIST_STORAGE_KEY = 'crypto_watchlist';

/**
 * Lade Watchlist aus LocalStorage
 * 
 * @returns {Array} Array von Symbol-Strings
 */
export function loadWatchlist() {
  try {
    const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading watchlist:', error);
    return [];
  }
}

/**
 * Speichere Watchlist in LocalStorage
 * 
 * @param {Array} watchlist - Array von Symbol-Strings
 */
export function saveWatchlist(watchlist) {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  } catch (error) {
    console.error('Error saving watchlist:', error);
  }
}

/**
 * Füge Symbol zur Watchlist hinzu
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 * @returns {Array} Aktualisierte Watchlist
 */
export function addToWatchlist(symbol) {
  const watchlist = loadWatchlist();
  const upperSymbol = symbol.toUpperCase();
  
  if (!watchlist.includes(upperSymbol)) {
    watchlist.push(upperSymbol);
    saveWatchlist(watchlist);
  }
  
  return watchlist;
}

/**
 * Entferne Symbol aus Watchlist
 * 
 * @param {string} symbol - Crypto Symbol
 * @returns {Array} Aktualisierte Watchlist
 */
export function removeFromWatchlist(symbol) {
  const watchlist = loadWatchlist();
  const upperSymbol = symbol.toUpperCase();
  const filtered = watchlist.filter(s => s !== upperSymbol);
  saveWatchlist(filtered);
  return filtered;
}

/**
 * Prüfe ob Symbol in Watchlist ist
 * 
 * @param {string} symbol - Crypto Symbol
 * @returns {boolean}
 */
export function isInWatchlist(symbol) {
  const watchlist = loadWatchlist();
  return watchlist.includes(symbol.toUpperCase());
}

/**
 * Notification Settings Verwaltung
 */

const NOTIFICATION_SETTINGS_STORAGE_KEY = 'crypto_notification_settings';

/**
 * Lade Notification Settings aus LocalStorage
 * 
 * @returns {Object} Notification Settings
 */
export function loadNotificationSettings() {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (!stored) {
      // Default settings
      return {
        enabled: true,
        signals: {
          STRONG_BUY: true,
          BUY: false,
          HOLD: false,
          SELL: true,
          STRONG_SELL: true
        },
        portfolioSellAlerts: true,
        watchlistAlerts: true
      };
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading notification settings:', error);
    return {
      enabled: true,
      signals: {
        STRONG_BUY: true,
        BUY: false,
        HOLD: false,
        SELL: true,
        STRONG_SELL: true
      },
      portfolioSellAlerts: true,
      watchlistAlerts: true
    };
  }
}

/**
 * Speichere Notification Settings in LocalStorage
 * 
 * @param {Object} settings - Notification Settings
 */
export function saveNotificationSettings(settings) {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
}

/**
 * Trading Strategy Verwaltung
 */

const TRADING_STRATEGY_STORAGE_KEY = 'crypto_trading_strategy';

/**
 * Lade Trading Strategy aus LocalStorage
 * 
 * @returns {string} Strategy name ('conservative', 'aggressive', 'momentum')
 */
export function loadTradingStrategy() {
  try {
    const stored = localStorage.getItem(TRADING_STRATEGY_STORAGE_KEY);
    return stored || 'aggressive'; // Default: aggressive
  } catch (error) {
    console.error('Error loading trading strategy:', error);
    return 'aggressive';
  }
}

/**
 * Speichere Trading Strategy in LocalStorage
 * 
 * @param {string} strategy - Strategy name ('conservative', 'aggressive', 'momentum')
 */
export function saveTradingStrategy(strategy) {
  try {
    localStorage.setItem(TRADING_STRATEGY_STORAGE_KEY, strategy);
  } catch (error) {
    console.error('Error saving trading strategy:', error);
  }
}

/**
 * Portfolio Alert Verwaltung
 */

const PORTFOLIO_ALERTS_STORAGE_KEY = 'crypto_portfolio_alerts';

/**
 * Lade Portfolio Alerts aus LocalStorage
 * 
 * @returns {Object} Alert-Konfigurationen (symbol -> { profitThreshold, lossThreshold, enabled })
 */
export function loadPortfolioAlerts() {
  try {
    const stored = localStorage.getItem(PORTFOLIO_ALERTS_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading portfolio alerts:', error);
    return {};
  }
}

/**
 * Speichere Portfolio Alerts in LocalStorage
 * 
 * @param {Object} alerts - Alert-Konfigurationen
 */
export function savePortfolioAlerts(alerts) {
  try {
    localStorage.setItem(PORTFOLIO_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch (error) {
    console.error('Error saving portfolio alerts:', error);
  }
}

/**
 * Setze Alert für einen Portfolio-Eintrag
 * 
 * @param {string} symbol - Crypto Symbol
 * @param {Object} alertConfig - { profitThreshold, lossThreshold, enabled }
 */
export function setPortfolioAlert(symbol, alertConfig) {
  const alerts = loadPortfolioAlerts();
  alerts[symbol] = {
    profitThreshold: alertConfig.profitThreshold || null,
    lossThreshold: alertConfig.lossThreshold || null,
    enabled: alertConfig.enabled !== false
  };
  savePortfolioAlerts(alerts);
  return alerts;
}

/**
 * Entferne Alert für einen Portfolio-Eintrag
 * 
 * @param {string} symbol - Crypto Symbol
 */
export function removePortfolioAlert(symbol) {
  const alerts = loadPortfolioAlerts();
  delete alerts[symbol];
  savePortfolioAlerts(alerts);
  return alerts;
}

/**
 * Hole Alert-Konfiguration für einen Symbol
 * 
 * @param {string} symbol - Crypto Symbol
 * @returns {Object|null} Alert-Konfiguration oder null
 */
export function getPortfolioAlert(symbol) {
  const alerts = loadPortfolioAlerts();
  return alerts[symbol] || null;
}

