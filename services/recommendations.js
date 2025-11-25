/**
 * Buy/Sell Recommendations System - Enhanced Version
 * 
 * Dieses Modul kombiniert mehrere technische Indikatoren zu einem
 * gewichteten Score-System für Buy/Sell-Empfehlungen.
 * 
 * NEU: Entry Quality Score, Überhitzungs-Warnungen, Zwei-Stufen-Signale
 * 
 * Gewichtung:
 * - Langfristiger Trend: 30% (verhindert Strong Buy bei fallenden Kursen über Wochen)
 * - MACD: 20% (Trendwechsel-Signale)
 * - EMA Cross: 20% (Golden/Death Cross)
 * - ADX: 15% (Trend-Stärke)
 * - RSI: 10% (Überkauft/Überverkauft)
 * - Bollinger Bands: 5% (Volatilität/Extrempunkte)
 * - ATR: 0% (nur für Stop-Loss Distanz, nicht im Score)
 * 
 * Score-Interpretation:
 * - 60-100: Strong Buy (starke Kaufempfehlung)
 * - 40-60: Hold (halten, keine klare Richtung)
 * - 0-40: Sell (Verkaufsempfehlung)
 */

import { calculateAllIndicators } from './indicators.js';

/**
 * Hilfsfunktion: Letzten gültigen Wert aus Array holen
 */
function getLastValue(arr) {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && !isNaN(arr[i])) return arr[i];
  }
  return null;
}

/**
 * Analysiert MACD und gibt einen Score zurück
 * 
 * MACD Signale:
 * - Bullish: MACD Line kreuzt Signal Line nach oben (Histogram wird positiv)
 * - Bearish: MACD Line kreuzt Signal Line nach unten (Histogram wird negativ)
 * 
 * @param {Object} macd - MACD Objekt {macdLine, signalLine, histogram}
 * @returns {number} Score von 0-100 (100 = sehr bullish, 0 = sehr bearish)
 */
function analyzeMACD(macd) {
  if (!macd || !macd.macdLine || !macd.signalLine || !macd.histogram) {
    return 50; // Neutral wenn keine Daten
  }

  const macdLine = macd.macdLine;
  const signalLine = macd.signalLine;
  const histogram = macd.histogram;

  // Finde die letzten gültigen Werte
  let lastMACD = null;
  let lastSignal = null;
  let lastHistogram = null;
  let prevHistogram = null;

  for (let i = histogram.length - 1; i >= 0; i--) {
    if (histogram[i] !== null && lastHistogram === null) {
      lastHistogram = histogram[i];
      lastMACD = macdLine[i];
      lastSignal = signalLine[i];
    } else if (histogram[i] !== null && prevHistogram === null && i < histogram.length - 1) {
      prevHistogram = histogram[i];
      break;
    }
  }

  if (lastMACD === null || lastSignal === null || lastHistogram === null) {
    return 50; // Neutral wenn keine gültigen Werte
  }

  let score = 50; // Start bei neutral

  // 1. Histogram-Analyse (stärkstes Signal)
  // Positives Histogram = Bullish, Negatives = Bearish
  if (lastHistogram > 0) {
    score += 20; // Bullish Signal
    // Stärkeres Signal wenn Histogram wächst
    if (prevHistogram !== null && lastHistogram > prevHistogram) {
      score += 10; // Momentum steigt
    }
  } else if (lastHistogram < 0) {
    score -= 20; // Bearish Signal
    // Stärkeres Signal wenn Histogram fällt
    if (prevHistogram !== null && lastHistogram < prevHistogram) {
      score -= 10; // Momentum fällt
    }
  }

  // 2. MACD Line vs Signal Line
  // MACD über Signal = Bullish, darunter = Bearish
  if (lastMACD > lastSignal) {
    score += 15; // Bullish Crossover
  } else if (lastMACD < lastSignal) {
    score -= 15; // Bearish Crossover
  }

  // 3. MACD Line über/unter Null
  if (lastMACD > 0) {
    score += 5; // Im positiven Bereich
  } else {
    score -= 5; // Im negativen Bereich
  }

  // Begrenze Score auf 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert EMA Crossovers (Golden Cross / Death Cross)
 * 
 * Golden Cross: Kurzfristige EMA kreuzt langfristige EMA nach oben
 * Death Cross: Kurzfristige EMA kreuzt langfristige EMA nach unten
 * 
 * Wir analysieren mehrere Crossovers:
 * - EMA12 vs EMA26 (kurzfristig)
 * - EMA50 vs EMA200 (langfristig)
 * 
 * @param {Object} ema - EMA Objekt {ema12, ema26, ema50, ema200}
 * @returns {number} Score von 0-100
 */
function analyzeEMACross(ema) {
  if (!ema || !ema.ema12 || !ema.ema26 || !ema.ema50 || !ema.ema200) {
    return 50;
  }

  let score = 50; // Start bei neutral

  // Finde die letzten gültigen Werte
  const getLastValueWithIndex = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null) return { value: arr[i], index: i };
    }
    return null;
  };

  const ema12 = getLastValueWithIndex(ema.ema12);
  const ema26 = getLastValueWithIndex(ema.ema26);
  const ema50 = getLastValueWithIndex(ema.ema50);
  const ema200 = getLastValueWithIndex(ema.ema200);

  // Kurzfristiger Crossover (EMA12 vs EMA26)
  if (ema12 && ema26) {
    if (ema12.value > ema26.value) {
      score += 15; // Golden Cross (kurzfristig)
      
      // Prüfe ob Crossover gerade stattgefunden hat
      if (ema12.index > 0 && ema26.index > 0) {
        const prevEma12 = ema.ema12[ema12.index - 1];
        const prevEma26 = ema.ema26[ema26.index - 1];
        if (prevEma12 !== null && prevEma26 !== null && prevEma12 <= prevEma26) {
          score += 10; // Crossover gerade passiert (starkes Signal)
        }
      }
    } else {
      score -= 15; // Death Cross (kurzfristig)
      
      // Prüfe ob Crossover gerade stattgefunden hat
      if (ema12.index > 0 && ema26.index > 0) {
        const prevEma12 = ema.ema12[ema12.index - 1];
        const prevEma26 = ema.ema26[ema26.index - 1];
        if (prevEma12 !== null && prevEma26 !== null && prevEma12 >= prevEma26) {
          score -= 10; // Crossover gerade passiert (starkes Signal)
        }
      }
    }
  }

  // Langfristiger Crossover (EMA50 vs EMA200)
  if (ema50 && ema200) {
    if (ema50.value > ema200.value) {
      score += 10; // Golden Cross (langfristig)
      
      // Prüfe ob Crossover gerade stattgefunden hat
      if (ema50.index > 0 && ema200.index > 0) {
        const prevEma50 = ema.ema50[ema50.index - 1];
        const prevEma200 = ema.ema200[ema200.index - 1];
        if (prevEma50 !== null && prevEma200 !== null && prevEma50 <= prevEma200) {
          score += 5; // Langfristiger Crossover (sehr starkes Signal)
        }
      }
    } else {
      score -= 10; // Death Cross (langfristig)
      
      // Prüfe ob Crossover gerade stattgefunden hat
      if (ema50.index > 0 && ema200.index > 0) {
        const prevEma50 = ema.ema50[ema50.index - 1];
        const prevEma200 = ema.ema200[ema200.index - 1];
        if (prevEma50 !== null && prevEma200 !== null && prevEma50 >= prevEma200) {
          score -= 5; // Langfristiger Crossover (sehr starkes Signal)
        }
      }
    }
  }

  // Zusätzlich: Prüfe ob alle EMAs in der richtigen Reihenfolge sind
  // Bullish: EMA12 > EMA26 > EMA50 > EMA200
  // Bearish: EMA12 < EMA26 < EMA50 < EMA200
  if (ema12 && ema26 && ema50 && ema200) {
    if (ema12.value > ema26.value && ema26.value > ema50.value && ema50.value > ema200.value) {
      score += 5; // Perfekte Bullish-Ausrichtung
    } else if (ema12.value < ema26.value && ema26.value < ema50.value && ema50.value < ema200.value) {
      score -= 5; // Perfekte Bearish-Ausrichtung
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert ADX (Trend-Stärke)
 * 
 * ADX misst die Stärke eines Trends, nicht die Richtung.
 * 
 * Interpretation:
 * - ADX < 20: Schwacher oder kein Trend (neutral)
 * - ADX 20-25: Trend beginnt sich zu entwickeln
 * - ADX > 25: Starker Trend
 * - ADX > 50: Sehr starker Trend (selten)
 * 
 * Wir kombinieren ADX mit +DI/-DI um die Richtung zu bestimmen.
 * 
 * @param {Object} adx - ADX Objekt {adx, plusDI, minusDI}
 * @returns {number} Score von 0-100
 */
function analyzeADX(adx) {
  if (!adx || !adx.adx || !adx.plusDI || !adx.minusDI) {
    return 50;
  }

  const adxValue = getLastValue(adx.adx);
  const plusDI = getLastValue(adx.plusDI);
  const minusDI = getLastValue(adx.minusDI);

  if (adxValue === null) {
    return 50; // Neutral wenn keine Daten
  }

  let score = 50; // Start bei neutral

  // ADX < 20 bedeutet schwacher Trend = neutral
  if (adxValue < 20) {
    return 50; // Kein klarer Trend
  }

  // ADX >= 20 bedeutet es gibt einen Trend
  // Jetzt prüfen wir die Richtung mit +DI und -DI
  if (plusDI !== null && minusDI !== null) {
    if (plusDI > minusDI) {
      // Aufwärtstrend
      score = 50 + (adxValue / 2); // ADX stärkt den Bullish-Score
    } else if (minusDI > plusDI) {
      // Abwärtstrend
      score = 50 - (adxValue / 2); // ADX stärkt den Bearish-Score
    }
  } else {
    // Wenn keine DI-Werte verfügbar, nutze nur ADX
    // Starker Trend = stärkeres Signal (aber neutral in der Richtung)
    if (adxValue > 25) {
      score = 55; // Leicht bullish bei starkem Trend (konservativ)
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert RSI (Relative Strength Index)
 * 
 * RSI Interpretation:
 * - RSI > 70: Überkauft (Bearish Signal)
 * - RSI 50-70: Leicht bullish
 * - RSI 30-50: Leicht bearish
 * - RSI < 30: Überverkauft (Bullish Signal)
 * 
 * @param {Array} rsi - Array von RSI-Werten (0-100)
 * @returns {number} Score von 0-100
 */
function analyzeRSI(rsi) {
  if (!rsi || rsi.length === 0) {
    return 50;
  }

  const lastRSI = getLastValue(rsi);

  if (lastRSI === null) {
    return 50; // Neutral wenn keine Daten
  }

  let score = 50; // Start bei neutral

  // RSI > 70 = Überkauft = Bearish
  if (lastRSI > 70) {
    const overboughtLevel = (lastRSI - 70) / 30; // 0-1 Skala (70-100)
    score -= 30 * overboughtLevel; // Bis zu -30 Punkte
  }
  // RSI < 30 = Überverkauft = Bullish
  else if (lastRSI < 30) {
    const oversoldLevel = (30 - lastRSI) / 30; // 0-1 Skala (0-30)
    score += 30 * oversoldLevel; // Bis zu +30 Punkte
  }
  // RSI 30-70 = Normalbereich
  else {
    // Lineare Skalierung: 30 = +15, 50 = 0, 70 = -15
    if (lastRSI < 50) {
      // 30-50: Leicht bullish
      score += 15 * ((50 - lastRSI) / 20);
    } else {
      // 50-70: Leicht bearish
      score -= 15 * ((lastRSI - 50) / 20);
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert Bollinger Bands
 * 
 * Bollinger Bands Interpretation:
 * - Preis nahe Upper Band (>95% der Bandbreite) = Überkauft
 * - Preis nahe Lower Band (<5% der Bandbreite) = Überverkauft
 * - Preis in der Mitte = Neutral
 * 
 * @param {Object} bollinger - Bollinger Bands Objekt {middle, upper, lower}
 * @param {number} currentPrice - Aktueller Schlusskurs
 * @returns {number} Score von 0-100
 */
function analyzeBollingerBands(bollinger, currentPrice) {
  if (!bollinger || !bollinger.upper || !bollinger.lower || !bollinger.middle) {
    return 50;
  }

  const upper = getLastValue(bollinger.upper);
  const lower = getLastValue(bollinger.lower);
  const middle = getLastValue(bollinger.middle);

  if (upper === null || lower === null || middle === null || currentPrice === null) {
    return 50;
  }

  // Berechne die Position des Preises innerhalb der Bands
  // 0 = an Lower Band, 1 = an Upper Band
  const bandWidth = upper - lower;
  if (bandWidth === 0) {
    return 50; // Keine Bandbreite = neutral
  }

  const position = (currentPrice - lower) / bandWidth;

  let score = 50; // Start bei neutral

  // Preis nahe Upper Band (>0.95) = Überkauft = Bearish
  if (position > 0.95) {
    score -= 20; // Stark bearish
  }
  // Preis nahe Lower Band (<0.05) = Überverkauft = Bullish
  else if (position < 0.05) {
    score += 20; // Stark bullish
  }
  // Preis zwischen 0.05 und 0.95
  else {
    // Lineare Skalierung: Lower = +20, Middle = 0, Upper = -20
    if (position < 0.5) {
      // Untere Hälfte: Leicht bullish
      score += 20 * (1 - (position / 0.5));
    } else {
      // Obere Hälfte: Leicht bearish
      score -= 20 * ((position - 0.5) / 0.5);
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert langfristige Preis-Trends
 * 
 * Diese Funktion erkennt langfristige Abwärtstrends, die kurzfristige
 * Indikatoren überschreiben sollten. Wenn ein Coin seit Wochen fällt,
 * sollte das keine Strong Buy-Empfehlung geben.
 * 
 * Analysiert Preisänderungen über 7, 14 und 30 Tage und bestraft
 * konsistente Abwärtstrends stark.
 * 
 * @param {Array} candles - Array von Candle-Objekten
 * @returns {number} Score von 0-100 (100 = sehr bullish langfristig, 0 = sehr bearish)
 */
function analyzeLongTermTrend(candles) {
  if (!candles || candles.length < 30) {
    return 50; // Neutral wenn nicht genug Daten
  }

  const currentPrice = candles[candles.length - 1].close;
  let score = 50; // Start bei neutral

  // Bestimme Candles pro Tag basierend auf Datenlänge
  // Bei 720 Candles = 30 Tage = 24 Candles/Tag (1h Interval)
  // Bei 180 Candles = 30 Tage = 6 Candles/Tag (4h Interval)
  // Bei 30 Candles = 30 Tage = 1 Candle/Tag (1d Interval)
  const totalDays = 30; // Wir holen immer 30 Tage
  const candlesPerDay = candles.length / totalDays;

  // Analysiere verschiedene Zeiträume
  const periods = [
    { days: 7, weight: 0.25 },
    { days: 14, weight: 0.35 },
    { days: 30, weight: 0.40 } // Längster Zeitraum hat höchste Gewichtung
  ];

  const trendValues = [];

  periods.forEach(({ days, weight }) => {
    const candlesBack = Math.floor(days * candlesPerDay);
    if (candles.length > candlesBack && candlesBack > 0) {
      const pastPrice = candles[candles.length - candlesBack - 1].close;
      const changePercent = ((currentPrice - pastPrice) / pastPrice) * 100;
      trendValues.push(changePercent);

      if (changePercent > 0) {
        // Aufwärtstrend
        if (changePercent > 20) {
          score += 15 * weight; // Sehr starke Gewinne
        } else if (changePercent > 10) {
          score += 12 * weight;
        } else if (changePercent > 5) {
          score += 8 * weight;
        } else {
          score += 4 * weight;
        }
      } else {
        // Abwärtstrend - STRAFE
        if (changePercent < -20) {
          score -= 35 * weight; // Sehr starke Strafe für starke Verluste
        } else if (changePercent < -10) {
          score -= 30 * weight; // Starke Strafe
        } else if (changePercent < -5) {
          score -= 20 * weight; // Moderate Strafe
        } else {
          score -= 10 * weight; // Leichte Strafe
        }
      }
    }
  });

  // Zusätzliche Prüfung: Konsistenter Abwärtstrend über alle Zeiträume
  if (trendValues.length >= 3) {
    const allNegative = trendValues.every(trend => trend < -3);
    const allPositive = trendValues.every(trend => trend > 3);
    
    if (allNegative) {
      // Wenn ALLE Zeiträume negativ sind = konsistenter Abwärtstrend
      // Zusätzliche starke Strafe
      score -= 20;
    } else if (allPositive) {
      // Wenn ALLE Zeiträume positiv sind = konsistenter Aufwärtstrend
      score += 10;
    }
  }

  // Zusätzlich: Prüfe ob der Kurs deutlich unter dem 30-Tage-Hoch ist
  if (candles.length > Math.floor(30 * candlesPerDay)) {
    let maxPrice30Days = currentPrice;
    for (let i = candles.length - Math.floor(30 * candlesPerDay); i < candles.length; i++) {
      if (candles[i].high > maxPrice30Days) {
        maxPrice30Days = candles[i].high;
      }
    }
    
    const distanceFromHigh = ((currentPrice - maxPrice30Days) / maxPrice30Days) * 100;
    
    // Wenn der Kurs deutlich unter dem 30-Tage-Hoch ist (>15%), zusätzliche Strafe
    if (distanceFromHigh < -15) {
      score -= 10; // Zusätzliche Strafe wenn weit vom Hoch entfernt
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analysiert ATR für Stop-Loss Berechnung
 * 
 * ATR wird nicht direkt in den Score einbezogen, sondern
 * dient zur Berechnung der Stop-Loss Distanz.
 * 
 * @param {Array} atr - Array von ATR-Werten
 * @param {number} currentPrice - Aktueller Preis
 * @returns {Object} {stopLoss, stopLossPercent} - Stop-Loss Preis und Prozent
 */
function calculateStopLoss(atr, currentPrice) {
  if (!atr || !currentPrice) {
    return { stopLoss: null, stopLossPercent: null };
  }

  const lastATR = getLastValue(atr);

  if (lastATR === null) {
    return { stopLoss: null, stopLossPercent: null };
  }

  // Stop-Loss = Aktueller Preis ± (2 * ATR)
  // Für Long-Position: Stop-Loss unter dem Preis
  // Für Short-Position: Stop-Loss über dem Preis
  // Wir berechnen beide für Flexibilität
  const stopLossLong = currentPrice - (2 * lastATR); // Stop-Loss für Kauf
  const stopLossShort = currentPrice + (2 * lastATR); // Stop-Loss für Verkauf

  const stopLossPercentLong = ((currentPrice - stopLossLong) / currentPrice) * 100;
  const stopLossPercentShort = ((stopLossShort - currentPrice) / currentPrice) * 100;

  return {
    stopLossLong,
    stopLossShort,
    stopLossPercentLong,
    stopLossPercentShort,
    atr: lastATR
  };
}

/**
 * NEU: Berechnet Entry Quality Score
 * 
 * Misst, ob der aktuelle Zeitpunkt ein guter Einstiegspunkt ist.
 * Ein hoher Trend-Score bedeutet nicht automatisch guter Einstieg!
 * 
 * Idealer Einstieg: Starker Trend (ADX > 25, bullish) + Pullback (RSI 40-55)
 * Schlechter Einstieg: Starker Trend + überkauft (RSI > 70)
 * 
 * @param {Object} indicators - Alle berechneten Indikatoren
 * @param {Array} candles - Candle-Daten
 * @returns {number} Score 0-100 (100 = perfekter Einstieg)
 */
function calculateEntryQuality(indicators, candles) {
  let score = 50;
  
  const lastRSI = getLastValue(indicators.rsi);
  const adxValue = getLastValue(indicators.adx?.adx);
  const plusDI = getLastValue(indicators.adx?.plusDI);
  const minusDI = getLastValue(indicators.adx?.minusDI);
  const currentPrice = candles[candles.length - 1].close;
  
  // 1. RSI-Analyse im Kontext des Trends
  if (adxValue !== null && adxValue > 25 && plusDI !== null && minusDI !== null) {
    if (plusDI > minusDI) {
      // Aufwärtstrend vorhanden - prüfe RSI für guten Entry
      if (lastRSI !== null) {
        if (lastRSI >= 40 && lastRSI <= 55) {
          score += 25; // Ideale Pullback-Zone
        } else if (lastRSI >= 55 && lastRSI <= 65) {
          score += 10; // Noch akzeptabel
        } else if (lastRSI > 70) {
          score -= 25; // Überkauft - schlechter Einstieg
        } else if (lastRSI > 75) {
          score -= 35; // Stark überkauft - sehr schlechter Einstieg
        } else if (lastRSI < 40) {
          score += 15; // Überverkauft in Aufwärtstrend = gut
        }
      }
    } else if (minusDI > plusDI) {
      // Abwärtstrend - generell schlechter Einstieg für Long
      score -= 20;
      
      // Ausser RSI ist sehr überverkauft (Kontra-Trade)
      if (lastRSI !== null && lastRSI < 30) {
        score += 15; // Möglicher Bounce
      }
    }
  } else if (adxValue !== null && adxValue < 20) {
    // Kein klarer Trend - neutraler Entry
    score += 0;
  }
  
  // 2. Preis-Distanz zu EMA (Support-Test)
  const ema20 = getLastValue(indicators.sma?.sma20);
  const ema50 = getLastValue(indicators.ema?.ema50);
  
  if (ema20 && currentPrice) {
    const distanceFromEMA20 = ((currentPrice - ema20) / ema20) * 100;
    
    if (distanceFromEMA20 >= 0 && distanceFromEMA20 <= 2) {
      score += 15; // Preis testet EMA20 Support - guter Entry
    } else if (distanceFromEMA20 >= 2 && distanceFromEMA20 <= 5) {
      score += 5; // Nahe am Support
    } else if (distanceFromEMA20 > 10) {
      score -= 10; // Zu weit über EMA (extended)
    } else if (distanceFromEMA20 > 15) {
      score -= 20; // Stark extended
    }
  }
  
  // 3. Bollinger Band Position
  const upperBand = getLastValue(indicators.bollinger?.upper);
  const lowerBand = getLastValue(indicators.bollinger?.lower);
  const middleBand = getLastValue(indicators.bollinger?.middle);
  
  if (upperBand && lowerBand && middleBand && currentPrice) {
    const bandWidth = upperBand - lowerBand;
    if (bandWidth > 0) {
      const position = (currentPrice - lowerBand) / bandWidth;
      
      if (position > 0.9) {
        score -= 15; // Nahe Upper Band - schlechter Entry
      } else if (position < 0.3 && adxValue > 20 && plusDI > minusDI) {
        score += 10; // Nahe Lower Band in Aufwärtstrend - guter Entry
      } else if (position >= 0.4 && position <= 0.6) {
        score += 5; // Mittlerer Bereich - okay
      }
    }
  }
  
  // 4. Volumen-Check (wenn verfügbar)
  if (candles.length >= 20) {
    const recentCandles = candles.slice(-20);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / 20;
    const lastVolume = candles[candles.length - 1].volume;
    
    // Niedriges Volumen bei Pullback ist gut (wenig Verkaufsdruck)
    if (lastRSI && lastRSI < 55 && lastVolume < avgVolume * 0.7) {
      score += 5; // Pullback mit niedrigem Volumen
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * NEU: Generiert Überhitzungs-Warnungen
 * 
 * Warnt den User wenn technische Indikatoren auf erhöhtes
 * Rückschlag-Risiko hindeuten.
 * 
 * @param {Object} indicators - Alle berechneten Indikatoren
 * @param {Array} candles - Candle-Daten
 * @returns {Array} Array von Warning-Objekten
 */
function getOverheatWarnings(indicators, candles) {
  const warnings = [];
  
  const lastRSI = getLastValue(indicators.rsi);
  const currentPrice = candles[candles.length - 1].close;
  
  // 1. RSI Überhitzung
  if (lastRSI !== null) {
    if (lastRSI > 80) {
      warnings.push({
        type: 'RSI_EXTREME',
        severity: 'HIGH',
        value: lastRSI.toFixed(1),
        message: `RSI bei ${lastRSI.toFixed(1)} - extrem überkauft, hohes Rückschlag-Risiko`
      });
    } else if (lastRSI > 75) {
      warnings.push({
        type: 'RSI_OVERBOUGHT',
        severity: 'HIGH',
        value: lastRSI.toFixed(1),
        message: `RSI bei ${lastRSI.toFixed(1)} - stark überkauft`
      });
    } else if (lastRSI > 70) {
      warnings.push({
        type: 'RSI_ELEVATED',
        severity: 'MEDIUM',
        value: lastRSI.toFixed(1),
        message: `RSI bei ${lastRSI.toFixed(1)} - überkauft`
      });
    }
  }
  
  // 2. Preis über Bollinger Upper Band
  const upperBand = getLastValue(indicators.bollinger?.upper);
  if (upperBand && currentPrice > upperBand) {
    const percentAbove = ((currentPrice - upperBand) / upperBand * 100).toFixed(1);
    warnings.push({
      type: 'ABOVE_BOLLINGER',
      severity: 'MEDIUM',
      value: percentAbove,
      message: `Preis ${percentAbove}% über oberem Bollinger Band`
    });
  }
  
  // 3. Schnelle Preisbewegung (24h)
  if (candles.length >= 24) {
    const price24hAgo = candles[candles.length - 24]?.close;
    if (price24hAgo) {
      const change24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
      
      if (change24h > 50) {
        warnings.push({
          type: 'RAPID_MOVE_EXTREME',
          severity: 'HIGH',
          value: change24h.toFixed(1),
          message: `+${change24h.toFixed(1)}% in 24h - extrem erhöhtes Rückschlag-Risiko`
        });
      } else if (change24h > 30) {
        warnings.push({
          type: 'RAPID_MOVE',
          severity: 'HIGH',
          value: change24h.toFixed(1),
          message: `+${change24h.toFixed(1)}% in 24h - erhöhtes Rückschlag-Risiko`
        });
      } else if (change24h > 20) {
        warnings.push({
          type: 'STRONG_MOVE',
          severity: 'MEDIUM',
          value: change24h.toFixed(1),
          message: `+${change24h.toFixed(1)}% in 24h - starke Bewegung`
        });
      }
    }
  }
  
  // 4. Preis weit über EMAs (Extended)
  const ema20 = getLastValue(indicators.sma?.sma20);
  if (ema20 && currentPrice) {
    const distanceFromEMA = ((currentPrice - ema20) / ema20) * 100;
    
    if (distanceFromEMA > 20) {
      warnings.push({
        type: 'EXTENDED_FROM_EMA',
        severity: 'HIGH',
        value: distanceFromEMA.toFixed(1),
        message: `Preis ${distanceFromEMA.toFixed(1)}% über EMA20 - stark extended`
      });
    } else if (distanceFromEMA > 15) {
      warnings.push({
        type: 'ABOVE_EMA',
        severity: 'MEDIUM',
        value: distanceFromEMA.toFixed(1),
        message: `Preis ${distanceFromEMA.toFixed(1)}% über EMA20`
      });
    }
  }
  
  // 5. ADX sehr hoch (Trend könnte erschöpft sein)
  const adxValue = getLastValue(indicators.adx?.adx);
  if (adxValue !== null && adxValue > 50) {
    warnings.push({
      type: 'ADX_EXTREME',
      severity: 'MEDIUM',
      value: adxValue.toFixed(1),
      message: `ADX bei ${adxValue.toFixed(1)} - Trend könnte erschöpft sein`
    });
  }
  
  return warnings;
}

/**
 * NEU: Bestimmt das Signal-Status basierend auf Score und Entry Quality
 * 
 * Unterscheidet zwischen:
 * - STRONG_BUY_NOW: Jetzt einsteigen (Score hoch + Entry Quality hoch)
 * - BUY_PARTIAL: Teilposition möglich
 * - WATCH_FOR_PULLBACK: Auf Watchlist, warten auf besseren Entry
 * - HOLD: Halten
 * - SELL: Verkaufen
 * - STRONG_SELL: Stark verkaufen
 * 
 * @param {number} score - Gesamt-Score
 * @param {number} entryQuality - Entry Quality Score
 * @param {number} rsiValue - Aktueller RSI
 * @param {Array} warnings - Überhitzungs-Warnungen
 * @returns {string} Signal-Status
 */
function getSignalStatus(score, entryQuality, rsiValue, warnings) {
  const hasHighWarnings = warnings.some(w => w.severity === 'HIGH');
  const hasMediumWarnings = warnings.some(w => w.severity === 'MEDIUM');
  
  if (score >= 60) {
    // Bullish Zone
    if (hasHighWarnings) {
      return 'WATCH_FOR_PULLBACK'; // Zu heiss, warten
    }
    if (entryQuality >= 60) {
      return 'STRONG_BUY_NOW'; // Perfekt: Trend + guter Entry
    }
    if (entryQuality >= 45) {
      return 'BUY_PARTIAL'; // Okay: Trend gut, Entry akzeptabel
    }
    return 'WATCH_FOR_PULLBACK'; // Trend gut, aber Entry schlecht
  }
  
  if (score >= 50) {
    // Leicht bullish
    if (entryQuality >= 55 && !hasHighWarnings) {
      return 'BUY_PARTIAL';
    }
    return 'HOLD';
  }
  
  if (score >= 40) {
    return 'HOLD';
  }
  
  if (score >= 30) {
    return 'SELL';
  }
  
  return 'STRONG_SELL';
}

/**
 * NEU: Analysiert Volumen-Profil
 * 
 * Prüft ob Volumen bei Aufwärts- oder Abwärtsbewegungen höher ist.
 * Bullish: Mehr Volumen bei grünen Kerzen
 * Bearish: Mehr Volumen bei roten Kerzen
 * 
 * @param {Array} candles - Candle-Daten
 * @returns {Object} {score, bullishRatio, avgVolume}
 */
function analyzeVolume(candles) {
  if (!candles || candles.length < 20) {
    return { score: 50, bullishRatio: 0.5, avgVolume: 0 };
  }
  
  const recent = candles.slice(-20);
  let bullishVolume = 0;
  let bearishVolume = 0;
  
  recent.forEach(c => {
    if (c.close > c.open) {
      bullishVolume += c.volume;
    } else {
      bearishVolume += c.volume;
    }
  });
  
  const totalVolume = bullishVolume + bearishVolume;
  if (totalVolume === 0) {
    return { score: 50, bullishRatio: 0.5, avgVolume: 0 };
  }
  
  const bullishRatio = bullishVolume / totalVolume;
  const avgVolume = totalVolume / 20;
  
  // Score berechnen
  let score = 50;
  if (bullishRatio > 0.6) {
    score += 25 * ((bullishRatio - 0.6) / 0.4);
  } else if (bullishRatio < 0.4) {
    score -= 25 * ((0.4 - bullishRatio) / 0.4);
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    bullishRatio: Math.round(bullishRatio * 100),
    avgVolume
  };
}

/**
 * Berechnet den finalen Buy/Sell Score durch Kombination aller Indikatoren
 * 
 * ENHANCED: Jetzt mit Entry Quality, Warnungen und Signal-Status
 * 
 * @param {Array} candles - Array von Candle-Objekten
 * @returns {Object} Recommendations Objekt mit Score und Details
 */
export function calculateRecommendations(candles) {
  if (!candles || candles.length === 0) {
    throw new Error('Candles Array darf nicht leer sein');
  }

  // Berechne alle Indikatoren
  const indicators = calculateAllIndicators(candles);

  // Aktueller Preis (letzter Close)
  const currentPrice = candles[candles.length - 1].close;

  // Analysiere jeden Indikator einzeln (geben 50 zurück wenn null/fehlend)
  const macdScore = indicators.macd ? analyzeMACD(indicators.macd) : 50;
  const emaCrossScore = indicators.ema ? analyzeEMACross(indicators.ema) : 50;
  const adxScore = indicators.adx ? analyzeADX(indicators.adx) : 50;
  const rsiScore = indicators.rsi ? analyzeRSI(indicators.rsi) : 50;
  const bollingerScore = indicators.bollinger ? analyzeBollingerBands(indicators.bollinger, currentPrice) : 50;
  
  // Langfristige Trend-Analyse (wichtig für Erkennung von Abwärtstrends)
  const longTermTrendScore = analyzeLongTermTrend(candles);

  // Gewichtete Kombination der Scores
  // Langfristiger Trend: 30% (höchste Gewichtung - verhindert Strong Buy bei fallenden Kursen)
  // MACD: 20%, EMA Cross: 20%, ADX: 15%, RSI: 10%, Bollinger: 5%
  // Wenn Indikatoren fehlen, werden sie als neutral (50) gewertet
  const finalScore = 
    (longTermTrendScore * 0.30) +  // Langfristiger Trend hat höchste Gewichtung
    (macdScore * 0.20) +
    (emaCrossScore * 0.20) +
    (adxScore * 0.15) +
    (rsiScore * 0.10) +
    (bollingerScore * 0.05);

  // Berechne Stop-Loss
  const stopLoss = calculateStopLoss(indicators.atr, currentPrice);
  
  // NEU: Entry Quality Score
  const entryQuality = calculateEntryQuality(indicators, candles);
  
  // NEU: Überhitzungs-Warnungen
  const warnings = getOverheatWarnings(indicators, candles);
  
  // NEU: Volumen-Analyse
  const volumeAnalysis = analyzeVolume(candles);
  
  // Hole aktuelle Indikator-Werte
  const currentRSI = getLastValue(indicators.rsi);
  const currentADX = getLastValue(indicators.adx?.adx);

  // NEU: Signal-Status (ersetzt einfache Recommendation)
  const signalStatus = getSignalStatus(finalScore, entryQuality, currentRSI, warnings);
  
  // Legacy Recommendation für Abwärtskompatibilität
  let recommendation = 'HOLD';
  if (finalScore >= 60) {
    recommendation = 'STRONG_BUY';
  } else if (finalScore >= 50) {
    recommendation = 'BUY';
  } else if (finalScore >= 40) {
    recommendation = 'HOLD';
  } else if (finalScore >= 30) {
    recommendation = 'SELL';
  } else {
    recommendation = 'STRONG_SELL';
  }

  return {
    score: Math.round(finalScore * 10) / 10, // Auf 1 Dezimalstelle gerundet
    recommendation, // Legacy
    signalStatus, // NEU: Detaillierter Status
    entryQuality: Math.round(entryQuality * 10) / 10, // NEU
    warnings, // NEU: Array von Warnungen
    breakdown: {
      longTermTrend: Math.round(longTermTrendScore * 10) / 10,
      macd: Math.round(macdScore * 10) / 10,
      emaCross: Math.round(emaCrossScore * 10) / 10,
      adx: Math.round(adxScore * 10) / 10,
      rsi: Math.round(rsiScore * 10) / 10,
      bollinger: Math.round(bollingerScore * 10) / 10,
      volume: Math.round(volumeAnalysis.score * 10) / 10 // NEU
    },
    stopLoss,
    currentPrice,
    volumeAnalysis: { // NEU
      bullishRatio: volumeAnalysis.bullishRatio,
      avgVolume: volumeAnalysis.avgVolume
    },
    indicators: {
      // Nur die letzten Werte für einfache Anzeige (null wenn nicht verfügbar)
      rsi: currentRSI,
      adx: currentADX,
      macdHistogram: indicators.macd ? getLastValue(indicators.macd.histogram) : null
    }
  };
}
