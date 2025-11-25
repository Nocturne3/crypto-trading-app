/**
 * Backtesting Service
 * 
 * Testet die Performance der Empfehlungen an historischen Daten.
 * Ermöglicht Validierung ob "Strong Buy" Signale tatsächlich profitabel waren.
 * 
 * Features:
 * - Simpler Backtest für einzelne Symbole
 * - Statistiken: Win-Rate, Durchschnitts-Return
 * - Signal-Historie mit Entry/Exit Points
 */

import { getHistoricalData } from './binanceApi.js';
import { calculateRecommendations } from './recommendations.js';

/**
 * Führt einen Backtest für ein Symbol durch
 * 
 * Simuliert: Was wäre passiert wenn man bei jedem "Strong Buy" gekauft hätte?
 * 
 * @param {string} symbol - Trading Pair (z.B. "BTC")
 * @param {string} interval - Zeitintervall (z.B. "4h")
 * @param {Object} options - Optionen
 * @param {number} options.lookbackCandles - Anzahl Candles für Backtest (default: 500)
 * @param {number} options.holdPeriods - Wie lange halten nach Signal (default: 24 Candles)
 * @param {number} options.minScore - Minimum Score für Signal (default: 60)
 * @param {string} options.signalType - Welches Signal testen (default: 'STRONG_BUY')
 * @returns {Object} Backtest-Ergebnisse
 */
export async function runBacktest(symbol, interval, options = {}) {
  const {
    lookbackCandles = 500,
    holdPeriods = 24,
    minScore = 60,
    signalType = 'STRONG_BUY'
  } = options;

  // Hole historische Daten
  // Wir brauchen extra Candles für die Indikator-Berechnung (mind. 200 für EMA200)
  const totalCandles = lookbackCandles + 200 + holdPeriods;
  const candles = await getHistoricalData(symbol, interval, totalCandles);

  if (candles.length < totalCandles) {
    throw new Error(`Nicht genug Daten für Backtest. Benötigt: ${totalCandles}, Erhalten: ${candles.length}`);
  }

  const signals = [];
  const windowSize = 200; // Genug Daten für alle Indikatoren

  // Iteriere durch die Candles (ab Position windowSize)
  for (let i = windowSize; i < candles.length - holdPeriods; i++) {
    // Slice für Indikator-Berechnung
    const slice = candles.slice(i - windowSize, i + 1);
    
    try {
      const rec = calculateRecommendations(slice);
      
      // Prüfe ob Signal getriggert wurde
      const isSignal = 
        (signalType === 'STRONG_BUY' && rec.recommendation === 'STRONG_BUY') ||
        (signalType === 'BUY' && (rec.recommendation === 'STRONG_BUY' || rec.recommendation === 'BUY')) ||
        (signalType === 'STRONG_BUY_NOW' && rec.signalStatus === 'STRONG_BUY_NOW') ||
        (rec.score >= minScore);
      
      if (isSignal) {
        const entryCandle = candles[i];
        const entryPrice = entryCandle.close;
        const entryTime = entryCandle.time;
        
        // Berechne Returns nach verschiedenen Zeiträumen
        const returns = {};
        const checkPeriods = [6, 12, 24, 48, 72]; // Candles nach Entry
        
        checkPeriods.forEach(period => {
          if (i + period < candles.length) {
            const exitPrice = candles[i + period].close;
            returns[`return_${period}`] = ((exitPrice - entryPrice) / entryPrice) * 100;
          }
        });
        
        // Exit nach holdPeriods
        const exitCandle = candles[i + holdPeriods];
        const exitPrice = exitCandle?.close || entryPrice;
        const mainReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
        
        // Max Drawdown während Hold-Periode
        let maxDrawdown = 0;
        let maxPrice = entryPrice;
        for (let j = i; j <= i + holdPeriods && j < candles.length; j++) {
          if (candles[j].high > maxPrice) {
            maxPrice = candles[j].high;
          }
          const drawdown = ((candles[j].low - maxPrice) / maxPrice) * 100;
          if (drawdown < maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }
        
        signals.push({
          timestamp: new Date(entryTime).toISOString(),
          entryPrice,
          exitPrice,
          score: rec.score,
          entryQuality: rec.entryQuality,
          rsi: rec.indicators.rsi,
          signalStatus: rec.signalStatus,
          return: mainReturn,
          maxDrawdown,
          ...returns,
          isWin: mainReturn > 0
        });
        
        // Skip nächste Candles um Überlappung zu vermeiden
        i += Math.min(holdPeriods, 12);
      }
    } catch (error) {
      // Ignoriere Fehler bei einzelnen Berechnungen
      console.warn(`Backtest calculation error at index ${i}:`, error.message);
    }
  }

  // Berechne Statistiken
  const stats = calculateBacktestStats(signals, holdPeriods);

  return {
    symbol,
    interval,
    options: { lookbackCandles, holdPeriods, minScore, signalType },
    totalCandles: candles.length,
    periodStart: new Date(candles[windowSize].time).toISOString(),
    periodEnd: new Date(candles[candles.length - 1].time).toISOString(),
    stats,
    signals
  };
}

/**
 * Berechnet Statistiken aus Backtest-Signalen
 * 
 * @param {Array} signals - Array von Signal-Objekten
 * @param {number} holdPeriods - Halteperiode
 * @returns {Object} Statistiken
 */
function calculateBacktestStats(signals, holdPeriods) {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      winRate: 0,
      avgReturn: 0,
      avgWinReturn: 0,
      avgLossReturn: 0,
      maxWin: 0,
      maxLoss: 0,
      avgMaxDrawdown: 0,
      profitFactor: 0,
      expectancy: 0
    };
  }

  const wins = signals.filter(s => s.isWin);
  const losses = signals.filter(s => !s.isWin);

  const totalReturn = signals.reduce((sum, s) => sum + s.return, 0);
  const avgReturn = totalReturn / signals.length;

  const avgWinReturn = wins.length > 0 
    ? wins.reduce((sum, s) => sum + s.return, 0) / wins.length 
    : 0;

  const avgLossReturn = losses.length > 0 
    ? losses.reduce((sum, s) => sum + s.return, 0) / losses.length 
    : 0;

  const maxWin = Math.max(...signals.map(s => s.return), 0);
  const maxLoss = Math.min(...signals.map(s => s.return), 0);

  const avgMaxDrawdown = signals.reduce((sum, s) => sum + s.maxDrawdown, 0) / signals.length;

  // Profit Factor = Summe Gewinne / Summe Verluste (absolut)
  const totalWins = wins.reduce((sum, s) => sum + s.return, 0);
  const totalLosses = Math.abs(losses.reduce((sum, s) => sum + s.return, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
  const winRate = wins.length / signals.length;
  const lossRate = 1 - winRate;
  const expectancy = (winRate * avgWinReturn) + (lossRate * avgLossReturn);

  // Analyse nach Entry Quality
  const highQualitySignals = signals.filter(s => s.entryQuality >= 55);
  const lowQualitySignals = signals.filter(s => s.entryQuality < 45);

  const highQualityWinRate = highQualitySignals.length > 0
    ? highQualitySignals.filter(s => s.isWin).length / highQualitySignals.length
    : 0;

  const lowQualityWinRate = lowQualitySignals.length > 0
    ? lowQualitySignals.filter(s => s.isWin).length / lowQualitySignals.length
    : 0;

  // Analyse nach RSI bei Entry
  const oversoldEntries = signals.filter(s => s.rsi && s.rsi < 50);
  const overboughtEntries = signals.filter(s => s.rsi && s.rsi > 70);

  const oversoldWinRate = oversoldEntries.length > 0
    ? oversoldEntries.filter(s => s.isWin).length / oversoldEntries.length
    : 0;

  const overboughtWinRate = overboughtEntries.length > 0
    ? overboughtEntries.filter(s => s.isWin).length / overboughtEntries.length
    : 0;

  return {
    totalSignals: signals.length,
    winRate: (winRate * 100).toFixed(1),
    lossRate: (lossRate * 100).toFixed(1),
    avgReturn: avgReturn.toFixed(2),
    avgWinReturn: avgWinReturn.toFixed(2),
    avgLossReturn: avgLossReturn.toFixed(2),
    maxWin: maxWin.toFixed(2),
    maxLoss: maxLoss.toFixed(2),
    avgMaxDrawdown: avgMaxDrawdown.toFixed(2),
    profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
    expectancy: expectancy.toFixed(2),
    holdPeriods,
    
    // Entry Quality Analyse
    entryQualityAnalysis: {
      highQualitySignals: highQualitySignals.length,
      highQualityWinRate: (highQualityWinRate * 100).toFixed(1),
      lowQualitySignals: lowQualitySignals.length,
      lowQualityWinRate: (lowQualityWinRate * 100).toFixed(1)
    },
    
    // RSI Analyse
    rsiAnalysis: {
      oversoldEntries: oversoldEntries.length,
      oversoldWinRate: (oversoldWinRate * 100).toFixed(1),
      overboughtEntries: overboughtEntries.length,
      overboughtWinRate: (overboughtWinRate * 100).toFixed(1)
    }
  };
}

/**
 * Führt Multi-Symbol Backtest durch
 * 
 * Testet mehrere Symbole und aggregiert die Ergebnisse.
 * 
 * @param {Array} symbols - Array von Symbolen
 * @param {string} interval - Zeitintervall
 * @param {Object} options - Backtest-Optionen
 * @returns {Object} Aggregierte Ergebnisse
 */
export async function runMultiSymbolBacktest(symbols, interval, options = {}) {
  const results = [];
  const errors = [];

  for (const symbol of symbols) {
    try {
      const result = await runBacktest(symbol, interval, options);
      results.push(result);
    } catch (error) {
      errors.push({ symbol, error: error.message });
    }
  }

  // Aggregiere Statistiken
  const allSignals = results.flatMap(r => r.signals);
  const aggregatedStats = calculateBacktestStats(allSignals, options.holdPeriods || 24);

  // Pro-Symbol Übersicht
  const symbolSummary = results.map(r => ({
    symbol: r.symbol,
    signals: r.stats.totalSignals,
    winRate: r.stats.winRate,
    avgReturn: r.stats.avgReturn,
    profitFactor: r.stats.profitFactor
  }));

  // Beste und schlechteste Performer
  const sortedByWinRate = [...symbolSummary].sort((a, b) => 
    parseFloat(b.winRate) - parseFloat(a.winRate)
  );

  return {
    interval,
    options,
    symbolsAnalyzed: results.length,
    symbolsFailed: errors.length,
    aggregatedStats,
    symbolSummary,
    topPerformers: sortedByWinRate.slice(0, 5),
    worstPerformers: sortedByWinRate.slice(-5).reverse(),
    errors,
    detailedResults: results
  };
}

/**
 * Vergleicht verschiedene Signal-Strategien
 * 
 * @param {string} symbol - Trading Pair
 * @param {string} interval - Zeitintervall
 * @param {Object} options - Basis-Optionen
 * @returns {Object} Vergleich der Strategien
 */
export async function compareStrategies(symbol, interval, options = {}) {
  const strategies = [
    { name: 'Strong Buy Only', signalType: 'STRONG_BUY', minScore: 60 },
    { name: 'Buy + Strong Buy', signalType: 'BUY', minScore: 50 },
    { name: 'Strong Buy Now (Entry Quality)', signalType: 'STRONG_BUY_NOW', minScore: 60 },
    { name: 'High Score (65+)', signalType: 'STRONG_BUY', minScore: 65 },
    { name: 'Very High Score (70+)', signalType: 'STRONG_BUY', minScore: 70 }
  ];

  const results = [];

  for (const strategy of strategies) {
    try {
      const result = await runBacktest(symbol, interval, {
        ...options,
        signalType: strategy.signalType,
        minScore: strategy.minScore
      });
      
      results.push({
        strategy: strategy.name,
        ...result.stats
      });
    } catch (error) {
      results.push({
        strategy: strategy.name,
        error: error.message
      });
    }
  }

  return {
    symbol,
    interval,
    comparison: results
  };
}

export default {
  runBacktest,
  runMultiSymbolBacktest,
  compareStrategies
};
