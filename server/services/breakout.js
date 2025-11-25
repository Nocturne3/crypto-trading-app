/**
 * Breakout Detection Service
 * 
 * Erkennt potentielle Breakout-Situationen durch:
 * 1. Volatilitäts-Squeeze (Bollinger Bands)
 * 2. Volume-Anomalien
 * 3. Konsolidierung nahe Resistance
 * 4. Pattern-Kombination (Double Bottom + Divergenz + S/R)
 * 
 * Ziel: Frühzeitig "Breakout imminent" Signale generieren
 */

/**
 * Berechnet Bollinger Bands
 */
function calculateBollingerBands(candles, period = 20, stdDev = 2) {
  if (candles.length < period) return null;
  
  const bands = [];
  
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const closes = slice.map(c => c.close);
    
    // SMA
    const sma = closes.reduce((a, b) => a + b, 0) / period;
    
    // Standard Deviation
    const squaredDiffs = closes.map(c => Math.pow(c - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(variance);
    
    bands.push({
      timestamp: candles[i].timestamp,
      middle: sma,
      upper: sma + (stdDev * std),
      lower: sma - (stdDev * std),
      bandwidth: ((sma + (stdDev * std)) - (sma - (stdDev * std))) / sma * 100, // % Breite
      percentB: (candles[i].close - (sma - (stdDev * std))) / ((sma + (stdDev * std)) - (sma - (stdDev * std))) // Position im Band (0-1)
    });
  }
  
  return bands;
}

/**
 * Erkennt Volatilitäts-Squeeze (Bollinger Band Squeeze)
 * 
 * Ein Squeeze tritt auf wenn die Bands sehr eng werden
 * → Oft Vorbote eines grossen Moves
 */
function detectVolatilitySqueeze(candles, options = {}) {
  const {
    bbPeriod = 20,
    bbStdDev = 2,
    squeezeLookback = 50,      // Wie viele Kerzen zurück für Vergleich
    squeezeThreshold = 0.6     // Bandwidth muss unter 60% des Durchschnitts sein
  } = options;
  
  const bands = calculateBollingerBands(candles, bbPeriod, bbStdDev);
  if (!bands || bands.length < squeezeLookback) return null;
  
  // Aktuelle Bandwidth
  const currentBandwidth = bands[bands.length - 1].bandwidth;
  
  // Durchschnittliche Bandwidth der letzten X Kerzen
  const recentBands = bands.slice(-squeezeLookback);
  const avgBandwidth = recentBands.reduce((a, b) => a + b.bandwidth, 0) / squeezeLookback;
  
  // Minimum Bandwidth (historisch)
  const minBandwidth = Math.min(...recentBands.map(b => b.bandwidth));
  
  // Squeeze Score (0-100)
  // Je niedriger die aktuelle Bandwidth vs. Durchschnitt, desto höher der Score
  const bandwidthRatio = currentBandwidth / avgBandwidth;
  const squeezeScore = Math.max(0, Math.min(100, (1 - bandwidthRatio) * 150));
  
  // Ist es ein Squeeze?
  const isSqueeze = bandwidthRatio < squeezeThreshold;
  
  // Squeeze-Dauer: Wie lange ist die Bandwidth schon niedrig?
  let squeezeDuration = 0;
  for (let i = bands.length - 1; i >= 0; i--) {
    if (bands[i].bandwidth / avgBandwidth < squeezeThreshold) {
      squeezeDuration++;
    } else {
      break;
    }
  }
  
  // Position im Band (für Richtung)
  const percentB = bands[bands.length - 1].percentB;
  const direction = percentB > 0.5 ? 'BULLISH' : percentB < 0.5 ? 'BEARISH' : 'NEUTRAL';
  
  return {
    detected: isSqueeze,
    score: Math.round(squeezeScore),
    currentBandwidth: Math.round(currentBandwidth * 100) / 100,
    avgBandwidth: Math.round(avgBandwidth * 100) / 100,
    bandwidthRatio: Math.round(bandwidthRatio * 100) / 100,
    squeezeDuration,
    percentB: Math.round(percentB * 100) / 100,
    direction,
    bands: {
      upper: bands[bands.length - 1].upper,
      middle: bands[bands.length - 1].middle,
      lower: bands[bands.length - 1].lower
    },
    message: isSqueeze 
      ? `🔥 Volatilitäts-Squeeze erkannt! Bandwidth bei ${Math.round(bandwidthRatio * 100)}% des Durchschnitts. Breakout wahrscheinlich!`
      : `Keine Squeeze-Situation (Bandwidth: ${Math.round(bandwidthRatio * 100)}% des Durchschnitts)`
  };
}

/**
 * Erkennt Volume-Anomalien
 * 
 * Sucht nach:
 * - Steigendes Volumen bei Konsolidierung
 * - Volume-Spikes
 * - Accumulation (Volumen steigt, Preis stabil)
 */
function detectVolumeAnomaly(candles, options = {}) {
  const {
    lookback = 20,
    spikeThreshold = 2.0,      // 200% des Durchschnitts = Spike
    accumulationPeriod = 10,   // Kerzen für Accumulation-Check
    priceStableThreshold = 3   // Max 3% Preisänderung für "stabil"
  } = options;
  
  if (candles.length < lookback + accumulationPeriod) return null;
  
  const recentCandles = candles.slice(-lookback);
  const currentCandle = candles[candles.length - 1];
  
  // Durchschnittliches Volumen
  const avgVolume = recentCandles.reduce((a, c) => a + c.volume, 0) / lookback;
  const currentVolume = currentCandle.volume;
  
  // Volume Ratio
  const volumeRatio = currentVolume / avgVolume;
  
  // Ist es ein Spike?
  const isSpike = volumeRatio >= spikeThreshold;
  
  // Volumen-Trend (steigend/fallend)
  const firstHalfVolume = recentCandles.slice(0, lookback / 2).reduce((a, c) => a + c.volume, 0);
  const secondHalfVolume = recentCandles.slice(lookback / 2).reduce((a, c) => a + c.volume, 0);
  const volumeTrend = secondHalfVolume > firstHalfVolume * 1.2 ? 'RISING' : 
                      secondHalfVolume < firstHalfVolume * 0.8 ? 'FALLING' : 'STABLE';
  
  // Accumulation Check: Volumen steigt, aber Preis bleibt stabil
  const accumulationCandles = candles.slice(-accumulationPeriod);
  const accStartPrice = accumulationCandles[0].close;
  const accEndPrice = accumulationCandles[accumulationCandles.length - 1].close;
  const priceChange = Math.abs((accEndPrice - accStartPrice) / accStartPrice * 100);
  
  const accStartVolume = accumulationCandles.slice(0, accumulationPeriod / 2).reduce((a, c) => a + c.volume, 0);
  const accEndVolume = accumulationCandles.slice(accumulationPeriod / 2).reduce((a, c) => a + c.volume, 0);
  const volumeIncrease = accEndVolume > accStartVolume * 1.3;
  
  const isAccumulating = priceChange < priceStableThreshold && volumeIncrease;
  
  // Score berechnen
  let score = 0;
  if (volumeRatio >= 1.5) score += 30;
  if (volumeRatio >= 2.0) score += 20;
  if (volumeTrend === 'RISING') score += 25;
  if (isAccumulating) score += 25;
  
  return {
    detected: score >= 50 || isSpike,
    score: Math.min(100, score),
    currentVolume: Math.round(currentVolume),
    avgVolume: Math.round(avgVolume),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    isSpike,
    volumeTrend,
    isAccumulating,
    message: isAccumulating 
      ? `📊 Accumulation erkannt! Volumen steigt bei stabilem Preis - Big Money sammelt ein!`
      : isSpike 
        ? `📊 Volume-Spike! ${Math.round(volumeRatio * 100)}% des Durchschnitts`
        : volumeTrend === 'RISING'
          ? `📊 Steigendes Volumen - Interesse wächst`
          : `Normales Volumen-Niveau`
  };
}

/**
 * Erkennt Konsolidierung (Range-Trading)
 * 
 * Preis bewegt sich in enger Range → Breakout kommt
 */
function detectConsolidation(candles, options = {}) {
  const {
    period = 20,
    rangeThreshold = 5,  // Max 5% Range für Konsolidierung
    minPeriod = 10       // Mindestens 10 Kerzen in Range
  } = options;
  
  if (candles.length < period) return null;
  
  const recentCandles = candles.slice(-period);
  
  // Finde High und Low der Range
  const highs = recentCandles.map(c => c.high);
  const lows = recentCandles.map(c => c.low);
  
  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const currentPrice = candles[candles.length - 1].close;
  
  // Range in Prozent
  const rangePercent = ((rangeHigh - rangeLow) / rangeLow) * 100;
  
  // Ist es Konsolidierung?
  const isConsolidating = rangePercent < rangeThreshold;
  
  // Wie lange schon in der Range?
  let consolidationDuration = 0;
  for (let i = candles.length - 1; i >= Math.max(0, candles.length - 50); i--) {
    if (candles[i].high <= rangeHigh * 1.01 && candles[i].low >= rangeLow * 0.99) {
      consolidationDuration++;
    } else {
      break;
    }
  }
  
  // Position in der Range
  const positionInRange = (currentPrice - rangeLow) / (rangeHigh - rangeLow);
  const nearTop = positionInRange > 0.8;
  const nearBottom = positionInRange < 0.2;
  
  // Score
  let score = 0;
  if (isConsolidating) score += 40;
  if (consolidationDuration >= minPeriod) score += 30;
  if (nearTop || nearBottom) score += 30; // Nahe am Ausbruchspunkt
  
  return {
    detected: isConsolidating && consolidationDuration >= minPeriod,
    score: Math.min(100, score),
    rangeHigh,
    rangeLow,
    rangePercent: Math.round(rangePercent * 100) / 100,
    consolidationDuration,
    positionInRange: Math.round(positionInRange * 100) / 100,
    nearTop,
    nearBottom,
    breakoutDirection: nearTop ? 'UP' : nearBottom ? 'DOWN' : 'UNKNOWN',
    message: isConsolidating && consolidationDuration >= minPeriod
      ? `📦 Konsolidierung seit ${consolidationDuration} Kerzen in ${rangePercent.toFixed(1)}% Range. ${nearTop ? 'Preis am oberen Rand - Ausbruch nach oben möglich!' : nearBottom ? 'Preis am unteren Rand.' : 'Warte auf Ausbruch.'}`
      : `Keine klare Konsolidierung (Range: ${rangePercent.toFixed(1)}%)`
  };
}

/**
 * Erkennt Breakout in Echtzeit
 * 
 * Prüft ob gerade ein Breakout stattfindet
 */
function detectActiveBreakout(candles, options = {}) {
  const {
    lookback = 20,
    breakoutThreshold = 1.5,  // 1.5% über Range = Breakout
    volumeConfirmation = 1.5  // Volumen muss 150% des Durchschnitts sein
  } = options;
  
  if (candles.length < lookback + 5) return null;
  
  // Range der vorherigen Kerzen (ohne letzte 3)
  const rangeCandles = candles.slice(-lookback - 3, -3);
  const rangeHigh = Math.max(...rangeCandles.map(c => c.high));
  const rangeLow = Math.min(...rangeCandles.map(c => c.low));
  
  // Letzte Kerzen (die potentiellen Breakout-Kerzen)
  const recentCandles = candles.slice(-3);
  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;
  
  // Durchschnittsvolumen
  const avgVolume = rangeCandles.reduce((a, c) => a + c.volume, 0) / rangeCandles.length;
  const currentVolume = currentCandle.volume;
  const volumeRatio = currentVolume / avgVolume;
  
  // Breakout nach oben?
  const breakoutUp = currentPrice > rangeHigh * (1 + breakoutThreshold / 100);
  const breakoutUpPercent = ((currentPrice - rangeHigh) / rangeHigh) * 100;
  
  // Breakout nach unten?
  const breakoutDown = currentPrice < rangeLow * (1 - breakoutThreshold / 100);
  const breakoutDownPercent = ((rangeLow - currentPrice) / rangeLow) * 100;
  
  // Volume-Bestätigung
  const volumeConfirmed = volumeRatio >= volumeConfirmation;
  
  // Bestimme Breakout-Status
  let status = 'NONE';
  let direction = null;
  let strength = 0;
  let message = 'Kein aktiver Breakout';
  
  if (breakoutUp) {
    direction = 'UP';
    strength = Math.min(100, breakoutUpPercent * 20 + (volumeConfirmed ? 40 : 0));
    
    if (volumeConfirmed) {
      status = 'CONFIRMED';
      message = `🚀 BREAKOUT BESTÄTIGT! +${breakoutUpPercent.toFixed(2)}% über Range mit ${Math.round(volumeRatio * 100)}% Volumen!`;
    } else {
      status = 'UNCONFIRMED';
      message = `⚠️ Breakout nach oben, aber Volumen noch schwach (${Math.round(volumeRatio * 100)}%)`;
    }
  } else if (breakoutDown) {
    direction = 'DOWN';
    strength = Math.min(100, breakoutDownPercent * 20 + (volumeConfirmed ? 40 : 0));
    
    if (volumeConfirmed) {
      status = 'CONFIRMED';
      message = `📉 BREAKDOWN BESTÄTIGT! -${breakoutDownPercent.toFixed(2)}% unter Range mit ${Math.round(volumeRatio * 100)}% Volumen!`;
    } else {
      status = 'UNCONFIRMED';
      message = `⚠️ Breakdown, aber Volumen noch schwach`;
    }
  }
  
  return {
    detected: status !== 'NONE',
    status,
    direction,
    strength: Math.round(strength),
    rangeHigh,
    rangeLow,
    currentPrice,
    breakoutPercent: direction === 'UP' ? breakoutUpPercent : breakoutDownPercent,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    volumeConfirmed,
    message
  };
}

/**
 * Hauptfunktion: Kombinierte Breakout-Analyse
 * 
 * Kombiniert alle Signale zu einem Breakout-Score
 */
export function analyzeBreakout(candles, options = {}) {
  if (!candles || candles.length < 50) {
    return { error: 'Nicht genug Daten für Breakout-Analyse' };
  }
  
  const currentPrice = candles[candles.length - 1].close;
  const currentTime = candles[candles.length - 1].timestamp;
  
  // Einzelanalysen
  const squeeze = detectVolatilitySqueeze(candles, options.squeeze);
  const volume = detectVolumeAnomaly(candles, options.volume);
  const consolidation = detectConsolidation(candles, options.consolidation);
  const activeBreakout = detectActiveBreakout(candles, options.breakout);
  
  // Kombinierter Breakout-Score
  let breakoutScore = 0;
  let signals = [];
  
  // Squeeze-Signal (stark)
  if (squeeze?.detected) {
    breakoutScore += squeeze.score * 0.35;
    signals.push({
      type: 'SQUEEZE',
      score: squeeze.score,
      message: squeeze.message,
      direction: squeeze.direction
    });
  }
  
  // Volume-Signal
  if (volume?.detected) {
    breakoutScore += volume.score * 0.25;
    signals.push({
      type: 'VOLUME',
      score: volume.score,
      message: volume.message,
      isAccumulating: volume.isAccumulating
    });
  }
  
  // Konsolidierung-Signal
  if (consolidation?.detected) {
    breakoutScore += consolidation.score * 0.25;
    signals.push({
      type: 'CONSOLIDATION',
      score: consolidation.score,
      message: consolidation.message,
      direction: consolidation.breakoutDirection
    });
  }
  
  // Aktiver Breakout (überschreibt alles)
  if (activeBreakout?.detected) {
    breakoutScore = Math.max(breakoutScore, activeBreakout.strength + 20);
    signals.unshift({
      type: 'ACTIVE_BREAKOUT',
      score: activeBreakout.strength,
      message: activeBreakout.message,
      direction: activeBreakout.direction,
      confirmed: activeBreakout.status === 'CONFIRMED'
    });
  }
  
  // Bonus für Kombination von Signalen
  if (signals.length >= 2) {
    breakoutScore += 10;
  }
  if (signals.length >= 3) {
    breakoutScore += 10;
  }
  
  breakoutScore = Math.min(100, Math.round(breakoutScore));
  
  // Bestimme Breakout-Wahrscheinlichkeit
  let probability = 'LOW';
  let probabilityLabel = 'Gering';
  if (breakoutScore >= 70) {
    probability = 'HIGH';
    probabilityLabel = 'Hoch';
  } else if (breakoutScore >= 50) {
    probability = 'MEDIUM';
    probabilityLabel = 'Mittel';
  }
  
  // Bestimme wahrscheinliche Richtung
  let likelyDirection = 'UNKNOWN';
  if (activeBreakout?.direction) {
    likelyDirection = activeBreakout.direction;
  } else if (squeeze?.direction === 'BULLISH' || consolidation?.nearTop) {
    likelyDirection = 'UP';
  } else if (squeeze?.direction === 'BEARISH' || consolidation?.nearBottom) {
    likelyDirection = 'DOWN';
  }
  
  // Generiere Zusammenfassung
  let summary = '';
  if (activeBreakout?.detected && activeBreakout.status === 'CONFIRMED') {
    summary = `🚀 AKTIVER BREAKOUT! ${activeBreakout.direction === 'UP' ? 'Bullish' : 'Bearish'} mit Volumen-Bestätigung!`;
  } else if (breakoutScore >= 70) {
    summary = `🔥 Breakout IMMINENT! ${signals.length} Signale erkannt. Wahrscheinliche Richtung: ${likelyDirection === 'UP' ? '↑ Aufwärts' : likelyDirection === 'DOWN' ? '↓ Abwärts' : 'Unbekannt'}`;
  } else if (breakoutScore >= 50) {
    summary = `⚠️ Breakout möglich. ${signals.length} Signal(e) aktiv. Beobachten!`;
  } else {
    summary = `😴 Keine Breakout-Situation erkannt.`;
  }
  
  return {
    score: breakoutScore,
    probability,
    probabilityLabel,
    likelyDirection,
    summary,
    signals,
    details: {
      squeeze,
      volume,
      consolidation,
      activeBreakout
    },
    levels: {
      resistanceBreakout: consolidation?.rangeHigh || null,
      supportBreakdown: consolidation?.rangeLow || null,
      currentPrice
    },
    meta: {
      analyzedAt: new Date().toISOString(),
      candlesAnalyzed: candles.length,
      timestamp: currentTime
    }
  };
}

/**
 * Schneller Breakout-Check für Screener
 */
export function quickBreakoutCheck(candles) {
  if (!candles || candles.length < 30) {
    return { score: 0, detected: false };
  }
  
  let score = 0;
  
  // Quick Squeeze Check
  const bands = calculateBollingerBands(candles, 20, 2);
  if (bands && bands.length > 0) {
    const recentBands = bands.slice(-20);
    const avgBandwidth = recentBands.reduce((a, b) => a + b.bandwidth, 0) / recentBands.length;
    const currentBandwidth = bands[bands.length - 1].bandwidth;
    if (currentBandwidth < avgBandwidth * 0.6) {
      score += 35;
    }
  }
  
  // Quick Volume Check
  const recentCandles = candles.slice(-20);
  const avgVolume = recentCandles.reduce((a, c) => a + c.volume, 0) / 20;
  const currentVolume = candles[candles.length - 1].volume;
  if (currentVolume > avgVolume * 1.5) {
    score += 25;
  }
  
  // Quick Range Check
  const rangeHigh = Math.max(...recentCandles.map(c => c.high));
  const rangeLow = Math.min(...recentCandles.map(c => c.low));
  const rangePercent = ((rangeHigh - rangeLow) / rangeLow) * 100;
  if (rangePercent < 5) {
    score += 25;
  }
  
  // Preis nahe Range-Grenze?
  const currentPrice = candles[candles.length - 1].close;
  const positionInRange = (currentPrice - rangeLow) / (rangeHigh - rangeLow);
  if (positionInRange > 0.85 || positionInRange < 0.15) {
    score += 15;
  }
  
  return {
    score: Math.min(100, score),
    detected: score >= 50,
    direction: positionInRange > 0.5 ? 'UP' : 'DOWN'
  };
}

export default {
  analyzeBreakout,
  quickBreakoutCheck,
  detectVolatilitySqueeze,
  detectVolumeAnomaly,
  detectConsolidation,
  detectActiveBreakout
};
