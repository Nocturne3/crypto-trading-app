/**
 * Pattern Detection Service
 * 
 * Erkennt:
 * 1. Support/Resistance Levels - Wichtige Preiszonen
 * 2. Double Bottom - Bullishes Umkehr-Pattern (W-Formation)
 * 3. Double Top - Bearishes Umkehr-Pattern (M-Formation)
 */

/**
 * Findet lokale Hochs und Tiefs (Pivot Points)
 * 
 * @param {Array} candles - Candle-Daten
 * @param {number} lookback - Kerzen links/rechts prüfen (default: 5)
 * @returns {Object} { highs: [], lows: [] }
 */
function findPivotPoints(candles, lookback = 5) {
  const highs = [];
  const lows = [];

  if (!candles || candles.length < lookback * 2 + 1) {
    return { highs, lows };
  }

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    // Prüfe ob aktueller Punkt höher/tiefer als alle Nachbarn
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      
      if (candles[j].high >= current.high) isHigh = false;
      if (candles[j].low <= current.low) isLow = false;
    }

    if (isHigh) {
      highs.push({
        index: i,
        price: current.high,
        timestamp: current.timestamp,
        candle: current
      });
    }
    
    if (isLow) {
      lows.push({
        index: i,
        price: current.low,
        timestamp: current.timestamp,
        candle: current
      });
    }
  }

  return { highs, lows };
}

/**
 * Gruppiert ähnliche Preislevels zu Zonen
 * 
 * @param {Array} pivots - Array von Pivot-Punkten
 * @param {number} tolerance - Prozentuale Toleranz (default: 1.5%)
 * @returns {Array} Gruppierte Levels
 */
function groupPriceLevels(pivots, tolerance = 0.015) {
  if (!pivots || pivots.length === 0) return [];

  // Sortiere nach Preis
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  
  const groups = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const groupAvg = currentGroup.reduce((sum, p) => sum + p.price, 0) / currentGroup.length;
    
    // Prüfe ob innerhalb der Toleranz
    const diff = Math.abs(current.price - groupAvg) / groupAvg;
    
    if (diff <= tolerance) {
      currentGroup.push(current);
    } else {
      // Speichere aktuelle Gruppe und starte neue
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [current];
    }
  }
  
  // Letzte Gruppe hinzufügen
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Berechnet Support und Resistance Levels
 * 
 * @param {Array} candles - Candle-Daten
 * @param {Object} options - Optionen
 * @returns {Object} { support: [], resistance: [], currentPrice }
 */
export function calculateSupportResistance(candles, options = {}) {
  const {
    lookback = 5,          // Kerzen für Pivot-Erkennung
    tolerance = 0.015,     // 1.5% Toleranz für Gruppierung
    minTouches = 2,        // Mindestens 2 Berührungen für valides Level
    maxLevels = 5          // Max Anzahl Levels pro Typ
  } = options;

  if (!candles || candles.length < 50) {
    return { support: [], resistance: [], currentPrice: null };
  }

  const currentPrice = candles[candles.length - 1].close;
  const pivots = findPivotPoints(candles, lookback);

  // Gruppiere Hochs und Tiefs
  const highGroups = groupPriceLevels(pivots.highs, tolerance);
  const lowGroups = groupPriceLevels(pivots.lows, tolerance);

  // Erstelle Level-Objekte
  const createLevel = (group, type) => {
    const prices = group.map(p => p.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const touches = group.length;
    const lastTouch = Math.max(...group.map(p => p.index));
    const firstTouch = Math.min(...group.map(p => p.index));
    
    // Stärke basiert auf Anzahl Berührungen und Alter
    const recency = (lastTouch / candles.length); // 0-1, höher = aktueller
    const strength = Math.min(100, (touches * 25) + (recency * 25));

    return {
      price: Math.round(avgPrice * 100) / 100,
      touches,
      strength: Math.round(strength),
      type,
      firstTouchIndex: firstTouch,
      lastTouchIndex: lastTouch,
      distancePercent: Math.round(((avgPrice - currentPrice) / currentPrice) * 1000) / 10
    };
  };

  // Alle potentiellen Levels
  const allLevels = [
    ...highGroups.filter(g => g.length >= minTouches).map(g => createLevel(g, 'high')),
    ...lowGroups.filter(g => g.length >= minTouches).map(g => createLevel(g, 'low'))
  ];

  // Trenne in Support (unter aktuellem Preis) und Resistance (über aktuellem Preis)
  const support = allLevels
    .filter(l => l.price < currentPrice)
    .sort((a, b) => b.price - a.price) // Nächstes zuerst
    .slice(0, maxLevels);

  const resistance = allLevels
    .filter(l => l.price > currentPrice)
    .sort((a, b) => a.price - b.price) // Nächstes zuerst
    .slice(0, maxLevels);

  // Berechne nächstes Support/Resistance
  const nearestSupport = support[0] || null;
  const nearestResistance = resistance[0] || null;

  return {
    support,
    resistance,
    currentPrice,
    nearest: {
      support: nearestSupport,
      resistance: nearestResistance
    },
    summary: createSRSummary(currentPrice, nearestSupport, nearestResistance)
  };
}

/**
 * Erstellt eine Zusammenfassung der S/R Analyse
 */
function createSRSummary(currentPrice, support, resistance) {
  if (!support && !resistance) {
    return {
      position: 'UNKNOWN',
      message: 'Keine klaren Support/Resistance Levels erkannt',
      riskReward: null
    };
  }

  const distToSupport = support ? Math.abs(support.distancePercent) : Infinity;
  const distToResistance = resistance ? Math.abs(resistance.distancePercent) : Infinity;

  let position = 'MIDDLE';
  let message = '';

  if (distToSupport < 2) {
    position = 'AT_SUPPORT';
    message = `Preis nahe Support ($${support.price}) - potentielle Kaufzone`;
  } else if (distToResistance < 2) {
    position = 'AT_RESISTANCE';
    message = `Preis nahe Resistance ($${resistance.price}) - potentielle Verkaufszone`;
  } else if (distToSupport < distToResistance) {
    position = 'NEAR_SUPPORT';
    message = `Preis näher am Support ($${support.price}, ${distToSupport.toFixed(1)}% entfernt)`;
  } else {
    position = 'NEAR_RESISTANCE';
    message = `Preis näher am Resistance ($${resistance.price}, ${distToResistance.toFixed(1)}% entfernt)`;
  }

  // Risk/Reward berechnen
  let riskReward = null;
  if (support && resistance) {
    const potentialLoss = currentPrice - support.price;
    const potentialGain = resistance.price - currentPrice;
    riskReward = potentialGain / potentialLoss;
  }

  return {
    position,
    message,
    riskReward: riskReward ? Math.round(riskReward * 100) / 100 : null,
    distanceToSupport: support ? distToSupport : null,
    distanceToResistance: resistance ? distToResistance : null
  };
}

/**
 * Erkennt Double Bottom Pattern (W-Formation)
 * 
 * Kriterien:
 * - Zwei Tiefs auf ähnlichem Level (±2%)
 * - Ein Hoch dazwischen (mindestens 3% über den Tiefs)
 * - Aktueller Preis über dem mittleren Hoch = Bestätigung
 * 
 * @param {Array} candles - Candle-Daten
 * @param {Object} options - Optionen
 * @returns {Object} Pattern-Analyse
 */
export function detectDoubleBottom(candles, options = {}) {
  const {
    tolerance = 0.02,      // 2% Toleranz für ähnliche Tiefs
    minMiddleHeight = 0.03, // Mittleres Hoch mindestens 3% über Tiefs
    lookbackCandles = 100,  // Wie weit zurückschauen
    minCandlesBetween = 5,  // Mindestabstand zwischen Tiefs
    maxCandlesBetween = 50  // Maximaler Abstand zwischen Tiefs
  } = options;

  if (!candles || candles.length < lookbackCandles) {
    return { found: false, patterns: [] };
  }

  const recentCandles = candles.slice(-lookbackCandles);
  const currentPrice = recentCandles[recentCandles.length - 1].close;
  const pivots = findPivotPoints(recentCandles, 3);
  
  const patterns = [];

  // Brauchen mindestens 2 Tiefs
  if (pivots.lows.length < 2) {
    return { found: false, patterns: [] };
  }

  // Prüfe alle Kombinationen von Tiefs
  for (let i = 0; i < pivots.lows.length - 1; i++) {
    for (let j = i + 1; j < pivots.lows.length; j++) {
      const low1 = pivots.lows[i];
      const low2 = pivots.lows[j];

      // Prüfe Abstand zwischen Tiefs
      const candlesBetween = low2.index - low1.index;
      if (candlesBetween < minCandlesBetween || candlesBetween > maxCandlesBetween) {
        continue;
      }

      // Prüfe ob Tiefs ähnlich sind (innerhalb Toleranz)
      const priceDiff = Math.abs(low1.price - low2.price) / low1.price;
      if (priceDiff > tolerance) {
        continue;
      }

      // Finde das Hoch zwischen den beiden Tiefs
      const middleHighs = pivots.highs.filter(h => h.index > low1.index && h.index < low2.index);
      if (middleHighs.length === 0) {
        continue;
      }

      const middleHigh = middleHighs.reduce((max, h) => h.price > max.price ? h : max);
      const avgLow = (low1.price + low2.price) / 2;

      // Prüfe ob mittleres Hoch hoch genug ist
      const heightPercent = (middleHigh.price - avgLow) / avgLow;
      if (heightPercent < minMiddleHeight) {
        continue;
      }

      // Pattern gefunden!
      const neckline = middleHigh.price;
      const isConfirmed = currentPrice > neckline;
      const targetPrice = neckline + (neckline - avgLow); // Projektion nach oben

      patterns.push({
        type: 'DOUBLE_BOTTOM',
        signal: 'BULLISH',
        confirmed: isConfirmed,
        low1: {
          price: low1.price,
          index: low1.index,
          candlesAgo: recentCandles.length - low1.index
        },
        low2: {
          price: low2.price,
          index: low2.index,
          candlesAgo: recentCandles.length - low2.index
        },
        neckline: Math.round(neckline * 100) / 100,
        avgLow: Math.round(avgLow * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        targetPercent: Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10,
        patternHeight: Math.round(heightPercent * 1000) / 10,
        strength: calculatePatternStrength(isConfirmed, heightPercent, priceDiff, candlesBetween),
        description: isConfirmed 
          ? '✅ Double Bottom bestätigt - Bullishes Umkehr-Signal!'
          : '⏳ Double Bottom in Bildung - Warte auf Ausbruch über Neckline'
      });
    }
  }

  // Sortiere nach Stärke und nimm das beste
  patterns.sort((a, b) => b.strength - a.strength);

  return {
    found: patterns.length > 0,
    patterns: patterns.slice(0, 3), // Max 3 Pattern
    bestPattern: patterns[0] || null
  };
}

/**
 * Erkennt Double Top Pattern (M-Formation)
 * 
 * Kriterien:
 * - Zwei Hochs auf ähnlichem Level (±2%)
 * - Ein Tief dazwischen (mindestens 3% unter den Hochs)
 * - Aktueller Preis unter dem mittleren Tief = Bestätigung
 * 
 * @param {Array} candles - Candle-Daten
 * @param {Object} options - Optionen
 * @returns {Object} Pattern-Analyse
 */
export function detectDoubleTop(candles, options = {}) {
  const {
    tolerance = 0.02,
    minMiddleDepth = 0.03,
    lookbackCandles = 100,
    minCandlesBetween = 5,
    maxCandlesBetween = 50
  } = options;

  if (!candles || candles.length < lookbackCandles) {
    return { found: false, patterns: [] };
  }

  const recentCandles = candles.slice(-lookbackCandles);
  const currentPrice = recentCandles[recentCandles.length - 1].close;
  const pivots = findPivotPoints(recentCandles, 3);
  
  const patterns = [];

  if (pivots.highs.length < 2) {
    return { found: false, patterns: [] };
  }

  for (let i = 0; i < pivots.highs.length - 1; i++) {
    for (let j = i + 1; j < pivots.highs.length; j++) {
      const high1 = pivots.highs[i];
      const high2 = pivots.highs[j];

      const candlesBetween = high2.index - high1.index;
      if (candlesBetween < minCandlesBetween || candlesBetween > maxCandlesBetween) {
        continue;
      }

      const priceDiff = Math.abs(high1.price - high2.price) / high1.price;
      if (priceDiff > tolerance) {
        continue;
      }

      // Finde das Tief zwischen den beiden Hochs
      const middleLows = pivots.lows.filter(l => l.index > high1.index && l.index < high2.index);
      if (middleLows.length === 0) {
        continue;
      }

      const middleLow = middleLows.reduce((min, l) => l.price < min.price ? l : min);
      const avgHigh = (high1.price + high2.price) / 2;

      const depthPercent = (avgHigh - middleLow.price) / avgHigh;
      if (depthPercent < minMiddleDepth) {
        continue;
      }

      const neckline = middleLow.price;
      const isConfirmed = currentPrice < neckline;
      const targetPrice = neckline - (avgHigh - neckline);

      patterns.push({
        type: 'DOUBLE_TOP',
        signal: 'BEARISH',
        confirmed: isConfirmed,
        high1: {
          price: high1.price,
          index: high1.index,
          candlesAgo: recentCandles.length - high1.index
        },
        high2: {
          price: high2.price,
          index: high2.index,
          candlesAgo: recentCandles.length - high2.index
        },
        neckline: Math.round(neckline * 100) / 100,
        avgHigh: Math.round(avgHigh * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        targetPercent: Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10,
        patternHeight: Math.round(depthPercent * 1000) / 10,
        strength: calculatePatternStrength(isConfirmed, depthPercent, priceDiff, candlesBetween),
        description: isConfirmed
          ? '✅ Double Top bestätigt - Bearishes Umkehr-Signal!'
          : '⏳ Double Top in Bildung - Warte auf Durchbruch unter Neckline'
      });
    }
  }

  patterns.sort((a, b) => b.strength - a.strength);

  return {
    found: patterns.length > 0,
    patterns: patterns.slice(0, 3),
    bestPattern: patterns[0] || null
  };
}

/**
 * Berechnet Pattern-Stärke
 */
function calculatePatternStrength(confirmed, height, priceDiff, candlesBetween) {
  let strength = 0;

  // Bestätigt = starkes Signal
  if (confirmed) strength += 40;

  // Höhe des Patterns (mehr = stärker)
  strength += Math.min(30, height * 300);

  // Je ähnlicher die Hochs/Tiefs, desto besser
  strength += Math.max(0, 20 - (priceDiff * 500));

  // Optimaler Abstand zwischen Punkten (15-30 Kerzen ideal)
  if (candlesBetween >= 15 && candlesBetween <= 30) {
    strength += 10;
  } else if (candlesBetween >= 10 && candlesBetween <= 40) {
    strength += 5;
  }

  return Math.min(100, Math.round(strength));
}

/**
 * Hauptfunktion: Analysiert alle Pattern für ein Symbol
 * 
 * @param {Array} candles - Candle-Daten
 * @returns {Object} Komplette Pattern-Analyse
 */
export function analyzePatterns(candles) {
  if (!candles || candles.length < 50) {
    return {
      supportResistance: { support: [], resistance: [] },
      doubleBottom: { found: false, patterns: [] },
      doubleTop: { found: false, patterns: [] },
      summary: {
        hasPattern: false,
        primarySignal: 'NEUTRAL',
        message: 'Nicht genug Daten für Pattern-Analyse'
      }
    };
  }

  // Berechne Support/Resistance
  const sr = calculateSupportResistance(candles);

  // Erkenne Double Bottom/Top
  const doubleBottom = detectDoubleBottom(candles);
  const doubleTop = detectDoubleTop(candles);

  // Erstelle Zusammenfassung
  let primarySignal = 'NEUTRAL';
  let message = 'Keine aktiven Pattern erkannt';
  let hasPattern = false;

  // Priorisiere bestätigte Pattern
  if (doubleBottom.bestPattern?.confirmed) {
    primarySignal = 'BULLISH';
    message = doubleBottom.bestPattern.description;
    hasPattern = true;
  } else if (doubleTop.bestPattern?.confirmed) {
    primarySignal = 'BEARISH';
    message = doubleTop.bestPattern.description;
    hasPattern = true;
  } else if (doubleBottom.found) {
    primarySignal = 'POTENTIAL_BULLISH';
    message = doubleBottom.bestPattern.description;
    hasPattern = true;
  } else if (doubleTop.found) {
    primarySignal = 'POTENTIAL_BEARISH';
    message = doubleTop.bestPattern.description;
    hasPattern = true;
  } else if (sr.summary.position === 'AT_SUPPORT') {
    primarySignal = 'POTENTIAL_BULLISH';
    message = sr.summary.message;
  } else if (sr.summary.position === 'AT_RESISTANCE') {
    primarySignal = 'POTENTIAL_BEARISH';
    message = sr.summary.message;
  }

  return {
    supportResistance: sr,
    doubleBottom,
    doubleTop,
    summary: {
      hasPattern,
      primarySignal,
      message,
      srPosition: sr.summary.position,
      riskReward: sr.summary.riskReward
    }
  };
}

export default {
  calculateSupportResistance,
  detectDoubleBottom,
  detectDoubleTop,
  analyzePatterns
};
