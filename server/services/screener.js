/**
 * Screener Service
 * 
 * Scannt alle Coins nach konfigurierbaren Kriterien:
 * - Score-basierte Filter
 * - Entry Quality Filter
 * - RSI Filter (Überkauft/Überverkauft)
 * - Pattern Filter (Double Bottom/Top, S/R Nähe)
 * - Divergenz Filter
 * - Volume Filter
 * 
 * Optimiert für Rate-Limits mit Caching und Queuing
 */

import { getScreenerData, getTop50Prices } from './binanceApi.js';
import { calculateAllIndicators } from './indicators.js';
import { calculateRecommendations } from './recommendations.js';

// Optional imports - diese können fehlen
let analyzeDivergences = null;
let analyzePatterns = null;

// Versuche optionale Module zu laden
try {
  const divergenceModule = await import('./divergence.js');
  analyzeDivergences = divergenceModule.analyzeDivergences;
} catch (e) {
  console.log('ℹ️ Divergence module not available');
}

try {
  const patternsModule = await import('./patterns.js');
  analyzePatterns = patternsModule.analyzePatterns;
} catch (e) {
  console.log('ℹ️ Patterns module not available');
}

/**
 * Standard Filter-Presets
 */
export const FILTER_PRESETS = {
  STRONG_BUY: {
    name: 'Strong Buy Candidates',
    description: 'Coins mit Score > 65 und guter Entry Quality',
    filters: {
      minScore: 65,
      minEntryQuality: 50,
      maxRSI: 70,
      signalStatus: ['STRONG_BUY_NOW', 'BUY_PARTIAL']
    }
  },
  PULLBACK_ENTRY: {
    name: 'Pullback Entries',
    description: 'Bullishe Coins mit RSI im Pullback-Bereich',
    filters: {
      minScore: 55,
      minRSI: 35,
      maxRSI: 50,
      minEntryQuality: 55
    }
  },
  OVERSOLD: {
    name: 'Überverkauft',
    description: 'Coins mit RSI < 30 (potentielle Reversal)',
    filters: {
      maxRSI: 30
    }
  },
  NEAR_SUPPORT: {
    name: 'Nahe Support',
    description: 'Coins die nahe einem Support-Level sind',
    filters: {
      nearSupport: true,
      maxDistanceToSupport: 3 // max 3% vom Support entfernt
    }
  },
  DOUBLE_BOTTOM: {
    name: 'Double Bottom Pattern',
    description: 'Coins mit bestätigtem Double Bottom',
    filters: {
      hasDoubleBottom: true,
      doubleBottomConfirmed: true
    }
  },
  BULLISH_DIVERGENCE: {
    name: 'Bullishe Divergenz',
    description: 'Coins mit RSI oder MACD Bullish Divergenz',
    filters: {
      hasBullishDivergence: true
    }
  },
  HIGH_VOLUME: {
    name: 'Hohes Volumen',
    description: 'Coins mit überdurchschnittlichem Volumen',
    filters: {
      minVolumeRatio: 1.5 // 150% des Durchschnitts
    }
  },
  CUSTOM: {
    name: 'Benutzerdefiniert',
    description: 'Eigene Filter',
    filters: {}
  }
};

/**
 * Analysiert einen einzelnen Coin
 */
async function analyzeCoin(symbol, candles, priceData, interval) {
  try {
    if (!candles || candles.length < 50) {
      return { symbol, error: 'Nicht genug Daten' };
    }

    // Nutze die bestehende calculateRecommendations Funktion
    const recommendations = calculateRecommendations(candles);
    
    // RSI Wert
    const currentRSI = recommendations.indicators?.rsi || null;
    
    // ADX Wert
    const currentADX = recommendations.indicators?.adx || null;
    
    // MACD
    const currentMACD = recommendations.indicators?.macdHistogram || null;

    // Divergenzen (optional)
    let divergence = null;
    if (analyzeDivergences) {
      try {
        const indicators = calculateAllIndicators(candles);
        divergence = analyzeDivergences(candles, indicators);
      } catch (e) {
        // Ignoriere Fehler bei Divergenz-Analyse
      }
    }

    // Pattern (optional)
    let patterns = null;
    if (analyzePatterns) {
      try {
        patterns = analyzePatterns(candles);
      } catch (e) {
        // Ignoriere Fehler bei Pattern-Analyse
      }
    }

    return {
      symbol,
      price: priceData?.price || candles[candles.length - 1].close,
      change24h: priceData?.change24h || 0,
      volume24h: priceData?.volume24h || 0,
      
      // Score & Signal (aus recommendations)
      score: recommendations.score,
      signal: recommendations.recommendation,
      signalStatus: recommendations.signalStatus,
      signalLabel: getSignalLabel(recommendations.signalStatus),
      
      // Entry Quality
      entryQuality: recommendations.entryQuality,
      entryLabel: getEntryLabel(recommendations.entryQuality),
      
      // Indikatoren
      rsi: currentRSI ? Math.round(currentRSI * 10) / 10 : null,
      adx: currentADX ? Math.round(currentADX * 10) / 10 : null,
      macdHistogram: currentMACD ? Math.round(currentMACD * 1000000) / 1000000 : null,
      
      // Warnungen
      warningsCount: recommendations.warnings?.length || 0,
      warnings: (recommendations.warnings || []).slice(0, 3),
      
      // Divergenz
      hasBullishDivergence: divergence?.combined?.signal === 'BULLISH',
      hasBearishDivergence: divergence?.combined?.signal === 'BEARISH',
      divergenceMessage: divergence?.combined?.message || null,
      
      // Pattern
      hasDoubleBottom: patterns?.doubleBottom?.found || false,
      doubleBottomConfirmed: patterns?.doubleBottom?.bestPattern?.confirmed || false,
      hasDoubleTop: patterns?.doubleTop?.found || false,
      doubleTopConfirmed: patterns?.doubleTop?.bestPattern?.confirmed || false,
      
      // Support/Resistance
      nearestSupport: patterns?.supportResistance?.nearest?.support?.price || null,
      nearestResistance: patterns?.supportResistance?.nearest?.resistance?.price || null,
      distanceToSupport: patterns?.supportResistance?.nearest?.support?.distancePercent || null,
      distanceToResistance: patterns?.supportResistance?.nearest?.resistance?.distancePercent || null,
      srPosition: patterns?.supportResistance?.summary?.position || null,
      
      // Meta
      interval,
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error analyzing ${symbol}:`, error.message);
    return { symbol, error: error.message };
  }
}

/**
 * Hilfsfunktion: Signal Label
 */
function getSignalLabel(status) {
  const labels = {
    'STRONG_BUY_NOW': 'Strong Buy',
    'BUY_PARTIAL': 'Buy',
    'WATCH_FOR_PULLBACK': 'Watch',
    'HOLD': 'Hold',
    'SELL': 'Sell',
    'STRONG_SELL': 'Strong Sell'
  };
  return labels[status] || status;
}

/**
 * Hilfsfunktion: Entry Quality Label
 */
function getEntryLabel(score) {
  if (score >= 70) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * Wendet Filter auf Coin-Daten an
 */
function applyFilters(coinData, filters) {
  // Score Filter
  if (filters.minScore !== undefined && coinData.score < filters.minScore) {
    return false;
  }
  if (filters.maxScore !== undefined && coinData.score > filters.maxScore) {
    return false;
  }
  
  // Entry Quality Filter
  if (filters.minEntryQuality !== undefined && coinData.entryQuality < filters.minEntryQuality) {
    return false;
  }
  
  // RSI Filter
  if (filters.minRSI !== undefined && coinData.rsi !== null && coinData.rsi < filters.minRSI) {
    return false;
  }
  if (filters.maxRSI !== undefined && coinData.rsi !== null && coinData.rsi > filters.maxRSI) {
    return false;
  }
  
  // ADX Filter
  if (filters.minADX !== undefined && coinData.adx !== null && coinData.adx < filters.minADX) {
    return false;
  }
  if (filters.maxADX !== undefined && coinData.adx !== null && coinData.adx > filters.maxADX) {
    return false;
  }
  
  // Signal Status Filter
  if (filters.signalStatus && filters.signalStatus.length > 0) {
    if (!filters.signalStatus.includes(coinData.signalStatus)) {
      return false;
    }
  }
  
  // 24h Change Filter
  if (filters.minChange24h !== undefined && coinData.change24h < filters.minChange24h) {
    return false;
  }
  if (filters.maxChange24h !== undefined && coinData.change24h > filters.maxChange24h) {
    return false;
  }
  
  // Divergenz Filter
  if (filters.hasBullishDivergence && !coinData.hasBullishDivergence) {
    return false;
  }
  if (filters.hasBearishDivergence && !coinData.hasBearishDivergence) {
    return false;
  }
  
  // Double Bottom Filter
  if (filters.hasDoubleBottom && !coinData.hasDoubleBottom) {
    return false;
  }
  if (filters.doubleBottomConfirmed && !coinData.doubleBottomConfirmed) {
    return false;
  }
  
  // Double Top Filter
  if (filters.hasDoubleTop && !coinData.hasDoubleTop) {
    return false;
  }
  if (filters.doubleTopConfirmed && !coinData.doubleTopConfirmed) {
    return false;
  }
  
  // Support Nähe Filter
  if (filters.nearSupport && coinData.srPosition !== 'AT_SUPPORT' && coinData.srPosition !== 'NEAR_SUPPORT') {
    return false;
  }
  if (filters.maxDistanceToSupport !== undefined && coinData.distanceToSupport !== null) {
    if (Math.abs(coinData.distanceToSupport) > filters.maxDistanceToSupport) {
      return false;
    }
  }
  
  // Resistance Nähe Filter
  if (filters.nearResistance && coinData.srPosition !== 'AT_RESISTANCE' && coinData.srPosition !== 'NEAR_RESISTANCE') {
    return false;
  }
  
  // Warnungen Filter
  if (filters.maxWarnings !== undefined && coinData.warningsCount > filters.maxWarnings) {
    return false;
  }
  if (filters.noWarnings && coinData.warningsCount > 0) {
    return false;
  }
  
  return true;
}

/**
 * Sortiert Ergebnisse
 */
function sortResults(results, sortBy = 'score', sortOrder = 'desc') {
  const sortFn = (a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    // Handle null values
    if (valA === null) valA = sortOrder === 'desc' ? -Infinity : Infinity;
    if (valB === null) valB = sortOrder === 'desc' ? -Infinity : Infinity;
    
    if (sortOrder === 'desc') {
      return valB - valA;
    }
    return valA - valB;
  };
  
  return results.sort(sortFn);
}

/**
 * Hauptfunktion: Führt Screener-Scan durch
 * 
 * @param {Object} options - Screener-Optionen
 * @param {string} options.preset - Filter-Preset Name
 * @param {Object} options.filters - Custom Filter (überschreibt Preset)
 * @param {string} options.interval - Timeframe (default: '4h')
 * @param {string} options.sortBy - Sortierfeld (default: 'score')
 * @param {string} options.sortOrder - 'asc' oder 'desc' (default: 'desc')
 * @param {number} options.limit - Max Ergebnisse (default: 50)
 * @returns {Object} Screener-Ergebnisse
 */
export async function runScreener(options = {}) {
  const {
    preset = null,
    filters: customFilters = {},
    interval = '4h',
    sortBy = 'score',
    sortOrder = 'desc',
    limit = 50
  } = options;
  
  const startTime = Date.now();
  console.log(`\n🔍 Starting Screener (interval: ${interval})...`);
  
  // Filter zusammenstellen
  let filters = {};
  if (preset && FILTER_PRESETS[preset]) {
    filters = { ...FILTER_PRESETS[preset].filters };
    console.log(`   Using preset: ${FILTER_PRESETS[preset].name}`);
  }
  filters = { ...filters, ...customFilters };
  
  try {
    // Hole alle Preise
    const prices = await getTop50Prices();
    const symbols = prices.map(p => p.symbol);
    
    console.log(`   Analyzing ${symbols.length} coins...`);
    
    // Hole Screener-Daten (mit Caching)
    const screenerData = await getScreenerData(symbols, interval);
    
    // Analysiere jeden Coin
    const analysisPromises = symbols.map(symbol => {
      const candles = screenerData.candles[symbol];
      const priceData = screenerData.prices[symbol];
      return analyzeCoin(symbol, candles, priceData, interval);
    });
    
    const allResults = await Promise.all(analysisPromises);
    
    // Filtere Fehler raus
    const validResults = allResults.filter(r => !r.error);
    const errorResults = allResults.filter(r => r.error);
    
    console.log(`   ✓ ${validResults.length} coins analyzed`);
    if (errorResults.length > 0) {
      console.log(`   ✗ ${errorResults.length} errors`);
    }
    
    // Wende Filter an
    const filteredResults = validResults.filter(coin => applyFilters(coin, filters));
    console.log(`   → ${filteredResults.length} match filters`);
    
    // Sortiere
    const sortedResults = sortResults(filteredResults, sortBy, sortOrder);
    
    // Limitiere
    const limitedResults = sortedResults.slice(0, limit);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Screener complete in ${duration}ms\n`);
    
    return {
      success: true,
      results: limitedResults,
      meta: {
        totalCoins: symbols.length,
        analyzedCoins: validResults.length,
        matchingCoins: filteredResults.length,
        returnedCoins: limitedResults.length,
        preset: preset || 'CUSTOM',
        presetName: preset ? FILTER_PRESETS[preset]?.name : 'Benutzerdefiniert',
        filters,
        interval,
        sortBy,
        sortOrder,
        duration,
        ...screenerData.meta
      },
      errors: errorResults.length > 0 ? errorResults : undefined
    };
    
  } catch (error) {
    console.error('❌ Screener error:', error);
    return {
      success: false,
      error: error.message,
      meta: {
        duration: Date.now() - startTime
      }
    };
  }
}

/**
 * Schneller Screener - nur Score und Basic Info
 * Für Dashboard-Übersicht
 */
export async function runQuickScreener(interval = '4h') {
  const startTime = Date.now();
  
  try {
    const prices = await getTop50Prices();
    const symbols = prices.map(p => p.symbol);
    
    const screenerData = await getScreenerData(symbols, interval);
    
    const results = [];
    
    for (const symbol of symbols) {
      const candles = screenerData.candles[symbol];
      const priceData = screenerData.prices[symbol];
      
      if (!candles || candles.length < 50) continue;
      
      try {
        const recommendations = calculateRecommendations(candles);
        
        results.push({
          symbol,
          price: priceData?.price,
          change24h: priceData?.change24h,
          score: recommendations.score,
          signal: recommendations.recommendation,
          signalStatus: recommendations.signalStatus,
          entryQuality: recommendations.entryQuality,
          rsi: recommendations.indicators?.rsi ? Math.round(recommendations.indicators.rsi * 10) / 10 : null,
          warningsCount: recommendations.warnings?.length || 0
        });
      } catch (e) {
        // Skip on error
      }
    }
    
    // Sortiere nach Score
    results.sort((a, b) => b.score - a.score);
    
    return {
      success: true,
      results,
      meta: {
        totalCoins: results.length,
        duration: Date.now() - startTime,
        interval
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  runScreener,
  runQuickScreener,
  FILTER_PRESETS
};
