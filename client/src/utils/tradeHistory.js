/**
 * Trade History Verwaltung
 * 
 * Verwaltet die komplette Trade-Historie (Käufe und Verkäufe)
 * für Performance-Tracking und Statistiken
 */

const TRADE_HISTORY_STORAGE_KEY = 'crypto_trade_history';
const PORTFOLIO_SNAPSHOT_STORAGE_KEY = 'crypto_portfolio_snapshots';

/**
 * Lade Trade-Historie aus LocalStorage
 * 
 * @returns {Array} Array von Trade-Events
 * {
 *   id: string (unique),
 *   type: 'BUY' | 'SELL',
 *   symbol: string,
 *   amount: number,
 *   price: number,
 *   totalValue: number,
 *   timestamp: string (ISO Date),
 *   notes?: string
 * }
 */
export function loadTradeHistory() {
  try {
    const stored = localStorage.getItem(TRADE_HISTORY_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading trade history:', error);
    return [];
  }
}

/**
 * Speichere Trade-Historie in LocalStorage
 * 
 * @param {Array} history - Array von Trade-Events
 */
export function saveTradeHistory(history) {
  try {
    localStorage.setItem(TRADE_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving trade history:', error);
  }
}

/**
 * Füge Trade-Event zur Historie hinzu
 * 
 * @param {Object} trade - Trade-Event
 * @returns {Array} Aktualisierte Trade-Historie
 */
export function addTradeToHistory(trade) {
  const history = loadTradeHistory();
  
  const newTrade = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...trade,
    timestamp: trade.timestamp || new Date().toISOString()
  };
  
  history.push(newTrade);
  // Sortiere nach Timestamp (neueste zuerst)
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  saveTradeHistory(history);
  return history;
}

/**
 * Entferne Trade aus Historie
 * 
 * @param {string} tradeId - ID des Trades
 * @returns {Array} Aktualisierte Trade-Historie
 */
export function removeTradeFromHistory(tradeId) {
  const history = loadTradeHistory();
  const filtered = history.filter(trade => trade.id !== tradeId);
  saveTradeHistory(filtered);
  return filtered;
}

/**
 * Portfolio Snapshots für Performance-Tracking
 * 
 * Speichert regelmäßig Portfolio-Wert für Performance-Charts
 */

/**
 * Lade Portfolio-Snapshots
 * 
 * @returns {Array} Array von Snapshots
 * {
 *   timestamp: string (ISO Date),
 *   totalValue: number,
 *   totalCost: number,
 *   totalProfit: number,
 *   totalProfitPercent: number
 * }
 */
export function loadPortfolioSnapshots() {
  try {
    const stored = localStorage.getItem(PORTFOLIO_SNAPSHOT_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading portfolio snapshots:', error);
    return [];
  }
}

/**
 * Speichere Portfolio-Snapshot
 * 
 * @param {Object} snapshot - Portfolio-Snapshot
 */
export function savePortfolioSnapshot(snapshot) {
  try {
    const snapshots = loadPortfolioSnapshots();
    snapshots.push({
      ...snapshot,
      timestamp: snapshot.timestamp || new Date().toISOString()
    });
    
    // Behalte nur die letzten 1000 Snapshots (ca. 1 Monat bei 1 Snapshot pro Stunde)
    if (snapshots.length > 1000) {
      snapshots.shift();
    }
    
    // Sortiere nach Timestamp
    snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    localStorage.setItem(PORTFOLIO_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (error) {
    console.error('Error saving portfolio snapshot:', error);
  }
}

/**
 * Berechne Trade-Statistiken
 * 
 * @param {Array} tradeHistory - Trade-Historie
 * @returns {Object} Statistiken
 */
export function calculateTradeStatistics(tradeHistory) {
  const trades = tradeHistory || [];
  
  // Sortiere Trades chronologisch (älteste zuerst) für korrekte FIFO-Matching
  // Falls kein Timestamp vorhanden, verwende ID als Fallback
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
    const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
    
    // Falls beide Timestamps fehlen oder gleich sind, sortiere nach ID
    if (dateA.getTime() === dateB.getTime()) {
      return (a.id || '').localeCompare(b.id || '');
    }
    
    return dateA - dateB;
  });
  
  // Gruppiere Trades nach Symbol
  const tradesBySymbol = {};
  trades.forEach(trade => {
    if (!tradesBySymbol[trade.symbol]) {
      tradesBySymbol[trade.symbol] = [];
    }
    tradesBySymbol[trade.symbol].push(trade);
  });
  
  // Berechne abgeschlossene Trades (BUY + SELL Paare)
  const completedTrades = [];
  const openPositions = {};
  
  sortedTrades.forEach(trade => {
    if (trade.type === 'BUY') {
      if (!openPositions[trade.symbol]) {
        openPositions[trade.symbol] = [];
      }
      openPositions[trade.symbol].push(trade);
    } else if (trade.type === 'SELL') {
      // Versuche mit ältestem BUY zu matchen (FIFO)
      if (openPositions[trade.symbol] && openPositions[trade.symbol].length > 0) {
        const buyTrade = openPositions[trade.symbol].shift();
        const profit = (trade.price - buyTrade.price) * trade.amount;
        const profitPercent = ((trade.price - buyTrade.price) / buyTrade.price) * 100;
        
        completedTrades.push({
          symbol: trade.symbol,
          buyPrice: buyTrade.price,
          sellPrice: trade.price,
          amount: trade.amount,
          profit,
          profitPercent,
          buyDate: buyTrade.timestamp,
          sellDate: trade.timestamp,
          holdingPeriod: new Date(trade.timestamp) - new Date(buyTrade.timestamp)
        });
      }
    }
  });
  
  // Berechne Statistiken
  const winningTrades = completedTrades.filter(t => t.profit > 0);
  const losingTrades = completedTrades.filter(t => t.profit <= 0);
  
  const totalProfit = completedTrades.reduce((sum, t) => sum + t.profit, 0);
  const avgProfit = completedTrades.length > 0 ? totalProfit / completedTrades.length : 0;
  const winRate = completedTrades.length > 0 
    ? (winningTrades.length / completedTrades.length) * 100 
    : 0;
  
  const bestTrade = completedTrades.length > 0
    ? completedTrades.reduce((best, t) => t.profit > best.profit ? t : best, completedTrades[0])
    : null;
  
  const worstTrade = completedTrades.length > 0
    ? completedTrades.reduce((worst, t) => t.profit < worst.profit ? t : worst, completedTrades[0])
    : null;
  
  return {
    totalTrades: trades.length,
    completedTrades: completedTrades.length,
    openPositions: Object.keys(openPositions).filter(s => openPositions[s].length > 0).length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalProfit,
    avgProfit,
    bestTrade,
    worstTrade,
    tradesBySymbol
  };
}

