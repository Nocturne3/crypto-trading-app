/**
 * Technische Indikatoren für Trend-Trading
 * 
 * Diese Datei enthält alle wissenschaftlich bewährten Indikatoren
 * für die Trend-Analyse von Kryptowährungen.
 * 
 * Jeder Indikator ist als reine Funktion implementiert,
 * die historische Preis-Daten (Candles) als Input nimmt.
 */

/**
 * SMA - Simple Moving Average (Einfacher gleitender Durchschnitt)
 * 
 * Der SMA ist der einfachste Trend-Indikator. Er berechnet den
 * Durchschnittspreis über eine bestimmte Anzahl von Perioden.
 * 
 * @param {Array} prices - Array von Schlusskursen (close prices)
 * @param {number} period - Anzahl der Perioden (z.B. 20, 50, 200)
 * @returns {Array} Array von SMA-Werten (gleiche Länge wie prices, erste Werte sind null)
 * 
 * Beispiel: SMA(20) = Durchschnitt der letzten 20 Schlusskurse
 */
export function calculateSMA(prices, period) {
  // Validiere Input
  if (!prices || prices.length < period) {
    throw new Error(`SMA benötigt mindestens ${period} Datenpunkte`);
  }

  const sma = [];
  
  // Die ersten (period - 1) Werte können nicht berechnet werden
  // da wir nicht genug historische Daten haben
  for (let i = 0; i < period - 1; i++) {
    sma.push(null);
  }

  // Berechne SMA für jeden Punkt ab der period-ten Position
  for (let i = period - 1; i < prices.length; i++) {
    // Summiere die letzten 'period' Preise
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j];
    }
    
    // Durchschnitt = Summe / Anzahl
    const average = sum / period;
    sma.push(average);
  }

  return sma;
}

/**
 * EMA - Exponential Moving Average (Exponentieller gleitender Durchschnitt)
 * 
 * Der EMA gibt neueren Preisen mehr Gewicht als älteren.
 * Er reagiert schneller auf Preisänderungen als der SMA.
 * 
 * Berechnung:
 * 1. Erster EMA-Wert = SMA der ersten 'period' Werte
 * 2. Multiplikator = 2 / (period + 1)
 * 3. EMA = (Preis - vorheriger EMA) * Multiplikator + vorheriger EMA
 * 
 * @param {Array} prices - Array von Schlusskursen
 * @param {number} period - Anzahl der Perioden (z.B. 12, 26, 50, 200)
 * @returns {Array} Array von EMA-Werten
 */
export function calculateEMA(prices, period) {
  if (!prices || prices.length < period) {
    throw new Error(`EMA benötigt mindestens ${period} Datenpunkte`);
  }

  const ema = [];
  
  // Multiplikator für die exponentielle Gewichtung
  // Je kleiner der Multiplikator, desto mehr Gewicht haben alte Werte
  const multiplier = 2 / (period + 1);

  // Erster EMA-Wert ist der SMA der ersten 'period' Werte
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  const initialEMA = sum / period;
  ema.push(initialEMA);

  // Berechne EMA für alle weiteren Werte
  // EMA = (aktueller Preis - vorheriger EMA) * Multiplikator + vorheriger EMA
  for (let i = period; i < prices.length; i++) {
    const currentPrice = prices[i];
    const previousEMA = ema[ema.length - 1];
    
    // Neue EMA = vorheriger EMA + Multiplikator * (Preis - vorheriger EMA)
    const newEMA = previousEMA + multiplier * (currentPrice - previousEMA);
    ema.push(newEMA);
  }

  // Fülle Anfang mit null, damit Array-Länge mit Input übereinstimmt
  const result = new Array(period - 1).fill(null);
  return result.concat(ema);
}

/**
 * RSI - Relative Strength Index (Relativer Stärke Index)
 * 
 * Der RSI misst die Stärke von Preisbewegungen und identifiziert
 * überkaufte (>70) und überverkaufte (<30) Bedingungen.
 * 
 * Berechnung:
 * 1. Berechne Gewinne und Verluste zwischen Perioden
 * 2. Berechne durchschnittliche Gewinne und Verluste (mit EMA)
 * 3. RS = Durchschnittliche Gewinne / Durchschnittliche Verluste
 * 4. RSI = 100 - (100 / (1 + RS))
 * 
 * @param {Array} prices - Array von Schlusskursen
 * @param {number} period - Anzahl der Perioden (Standard: 14)
 * @returns {Array} Array von RSI-Werten (0-100)
 */
export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    throw new Error(`RSI benötigt mindestens ${period + 1} Datenpunkte`);
  }

  const rsi = [];
  const gains = []; // Preissteigerungen
  const losses = []; // Preisverluste

  // Berechne Gewinne und Verluste zwischen aufeinanderfolgenden Perioden
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0); // Nur positive Änderungen
    losses.push(change < 0 ? Math.abs(change) : 0); // Nur negative Änderungen (als positive Zahl)
  }

  // Erste (period) RSI-Werte können nicht berechnet werden
  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }

  // Berechne initialen Durchschnitt für Gewinne und Verluste
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain = avgGain / period;
  avgLoss = avgLoss / period;

  // Berechne RSI für die erste gültige Periode
  if (avgLoss === 0) {
    rsi.push(100); // Wenn es keine Verluste gibt, ist RSI = 100
  } else {
    const rs = avgGain / avgLoss;
    const firstRSI = 100 - (100 / (1 + rs));
    rsi.push(firstRSI);
  }

  // Berechne RSI für alle weiteren Perioden mit Wilder's Smoothing
  // (ähnlich wie EMA, aber mit speziellem Multiplikator)
  const multiplier = 1 / period;
  
  for (let i = period; i < gains.length; i++) {
    // Wilder's Smoothing: Neuer Durchschnitt = (Alter Durchschnitt * (period-1) + Neuer Wert) / period
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const currentRSI = 100 - (100 / (1 + rs));
      rsi.push(currentRSI);
    }
  }

  // Füge null am Anfang hinzu, damit Länge mit Input übereinstimmt
  const result = [null]; // Erster Wert ist immer null (kein Vergleich möglich)
  return result.concat(rsi);
}

/**
 * MACD - Moving Average Convergence Divergence
 * 
 * MACD zeigt die Beziehung zwischen zwei EMAs und identifiziert
 * Trendwechsel und Momentum.
 * 
 * Berechnung:
 * 1. MACD Line = EMA(12) - EMA(26)
 * 2. Signal Line = EMA(9) der MACD Line
 * 3. Histogram = MACD Line - Signal Line
 * 
 * Signale:
 * - Bullish: MACD kreuzt Signal Line nach oben
 * - Bearish: MACD kreuzt Signal Line nach unten
 * 
 * @param {Array} prices - Array von Schlusskursen
 * @param {number} fastPeriod - Schnelle EMA Periode (Standard: 12)
 * @param {number} slowPeriod - Langsame EMA Periode (Standard: 26)
 * @param {number} signalPeriod - Signal Line EMA Periode (Standard: 9)
 * @returns {Object} { macdLine, signalLine, histogram }
 */
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!prices || prices.length < slowPeriod + signalPeriod) {
    throw new Error(`MACD benötigt mindestens ${slowPeriod + signalPeriod} Datenpunkte`);
  }

  // Berechne die beiden EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // MACD Line = Differenz zwischen schnellem und langsamem EMA
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }

  // Signal Line = EMA der MACD Line
  // Filtere null-Werte für EMA-Berechnung
  const macdLineValues = macdLine.filter(val => val !== null);
  const signalLineEMA = calculateEMA(macdLineValues, signalPeriod);

  // Rekonstruiere Signal Line mit null-Werten am Anfang
  const signalLine = [];
  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(signalLineEMA[signalIndex]);
      signalIndex++;
    }
  }

  // Histogram = MACD Line - Signal Line
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return {
    macdLine,
    signalLine,
    histogram
  };
}

/**
 * Bollinger Bands
 * 
 * Bollinger Bands bestehen aus drei Linien:
 * - Middle Band: SMA(20)
 * - Upper Band: SMA + (2 * Standardabweichung)
 * - Lower Band: SMA - (2 * Standardabweichung)
 * 
 * Interpretation:
 * - Preis nahe Upper Band = möglicherweise überkauft
 * - Preis nahe Lower Band = möglicherweise überverkauft
 * - Enge Bands = niedrige Volatilität
 * - Weite Bands = hohe Volatilität
 * 
 * @param {Array} prices - Array von Schlusskursen
 * @param {number} period - SMA Periode (Standard: 20)
 * @param {number} stdDev - Anzahl Standardabweichungen (Standard: 2)
 * @returns {Object} { middle, upper, lower }
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (!prices || prices.length < period) {
    throw new Error(`Bollinger Bands benötigen mindestens ${period} Datenpunkte`);
  }

  const middle = calculateSMA(prices, period);
  const upper = [];
  const lower = [];

  // Berechne Standardabweichung für jeden Punkt
  for (let i = period - 1; i < prices.length; i++) {
    // Berechne Durchschnitt der letzten 'period' Preise
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j];
    }
    const mean = sum / period;

    // Berechne Varianz (Durchschnitt der quadrierten Abweichungen)
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += Math.pow(prices[j] - mean, 2);
    }
    variance = variance / period;

    // Standardabweichung = Wurzel aus Varianz
    const standardDeviation = Math.sqrt(variance);

    // Upper Band = SMA + (stdDev * Standardabweichung)
    // Lower Band = SMA - (stdDev * Standardabweichung)
    upper.push(middle[i] + (stdDev * standardDeviation));
    lower.push(middle[i] - (stdDev * standardDeviation));
  }

  // Fülle Anfang mit null
  const upperResult = new Array(period - 1).fill(null).concat(upper);
  const lowerResult = new Array(period - 1).fill(null).concat(lower);

  return {
    middle,
    upper: upperResult,
    lower: lowerResult
  };
}

/**
 * ATR - Average True Range (Durchschnittliche wahre Spanne)
 * 
 * ATR misst die Volatilität und wird für Stop-Loss Berechnungen verwendet.
 * 
 * True Range = Maximum von:
 * 1. High - Low (aktuelle Kerze)
 * 2. |High - Previous Close| (High zu vorherigem Close)
 * 3. |Low - Previous Close| (Low zu vorherigem Close)
 * 
 * ATR = EMA der True Range Werte
 * 
 * @param {Array} candles - Array von Candle-Objekten {high, low, close}
 * @param {number} period - EMA Periode (Standard: 14)
 * @returns {Array} Array von ATR-Werten
 */
export function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) {
    throw new Error(`ATR benötigt mindestens ${period + 1} Candles`);
  }

  const trueRanges = [];

  // Berechne True Range für jede Kerze (ab der zweiten)
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    // True Range = Maximum der drei möglichen Spannen
    const tr1 = current.high - current.low; // Normale Spanne
    const tr2 = Math.abs(current.high - previous.close); // High zu vorherigem Close
    const tr3 = Math.abs(current.low - previous.close); // Low zu vorherigem Close

    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }

  // ATR = EMA der True Range Werte
  // Erster Wert ist der einfache Durchschnitt
  let sum = 0;
  for (let i = 0; i < period && i < trueRanges.length; i++) {
    sum += trueRanges[i];
  }
  const initialATR = sum / Math.min(period, trueRanges.length);

  // Berechne EMA für ATR
  const atr = [null, initialATR]; // Erster Wert null (kein Vergleich möglich)
  const multiplier = 2 / (period + 1);

  for (let i = 1; i < trueRanges.length; i++) {
    const previousATR = atr[atr.length - 1];
    const currentTR = trueRanges[i];
    const newATR = previousATR + multiplier * (currentTR - previousATR);
    atr.push(newATR);
  }

  return atr;
}

/**
 * ADX - Average Directional Index (Durchschnittlicher Richtungsindex)
 * 
 * ADX misst die Stärke eines Trends (nicht die Richtung!).
 * 
 * Berechnung:
 * 1. +DI und -DI (Directional Indicators) berechnen
 * 2. DX = |(+DI - -DI) / (+DI + -DI)| * 100
 * 3. ADX = EMA des DX
 * 
 * Interpretation:
 * - ADX < 20: Schwacher oder kein Trend
 * - ADX 20-25: Trend beginnt sich zu entwickeln
 * - ADX > 25: Starker Trend
 * - ADX > 50: Sehr starker Trend (selten)
 * 
 * @param {Array} candles - Array von Candle-Objekten {high, low, close}
 * @param {number} period - EMA Periode (Standard: 14)
 * @returns {Object} { adx, plusDI, minusDI }
 */
export function calculateADX(candles, period = 14) {
  if (!candles || candles.length < period + 1) {
    throw new Error(`ADX benötigt mindestens ${period + 1} Candles`);
  }

  const plusDM = []; // +DM (Plus Directional Movement)
  const minusDM = []; // -DM (Minus Directional Movement)
  const trueRanges = []; // True Range (gleiche wie bei ATR)

  // Berechne +DM, -DM und TR für jede Kerze (ab der zweiten)
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    // Berechne True Range (wie bei ATR)
    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - previous.close);
    const tr3 = Math.abs(current.low - previous.close);
    const tr = Math.max(tr1, tr2, tr3);
    trueRanges.push(tr);

    // Berechne Directional Movement
    const upMove = current.high - previous.high; // Aufwärtsbewegung
    const downMove = previous.low - current.low; // Abwärtsbewegung

    if (upMove > downMove && upMove > 0) {
      // Aufwärtstrend ist stärker
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      // Abwärtstrend ist stärker
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      // Keine klare Richtung
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  // Smoothing der +DM, -DM und TR Werte (Wilder's Smoothing)
  const smoothedPlusDM = [];
  const smoothedMinusDM = [];
  const smoothedTR = [];

  // Initiale Werte = Summe der ersten 'period' Werte
  let sumPlusDM = 0;
  let sumMinusDM = 0;
  let sumTR = 0;

  for (let i = 0; i < period && i < plusDM.length; i++) {
    sumPlusDM += plusDM[i];
    sumMinusDM += minusDM[i];
    sumTR += trueRanges[i];
  }

  smoothedPlusDM.push(sumPlusDM);
  smoothedMinusDM.push(sumMinusDM);
  smoothedTR.push(sumTR);

  // Smoothing für weitere Werte
  for (let i = period; i < plusDM.length; i++) {
    // Wilder's Smoothing
    smoothedPlusDM.push(
      smoothedPlusDM[smoothedPlusDM.length - 1] - 
      (smoothedPlusDM[smoothedPlusDM.length - 1] / period) + 
      plusDM[i]
    );
    smoothedMinusDM.push(
      smoothedMinusDM[smoothedMinusDM.length - 1] - 
      (smoothedMinusDM[smoothedMinusDM.length - 1] / period) + 
      minusDM[i]
    );
    smoothedTR.push(
      smoothedTR[smoothedTR.length - 1] - 
      (smoothedTR[smoothedTR.length - 1] / period) + 
      trueRanges[i]
    );
  }

  // Berechne +DI und -DI
  const plusDI = [];
  const minusDI = [];
  const dx = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    // +DI = (smoothed +DM / smoothed TR) * 100
    const plusDICalc = smoothedTR[i] !== 0 
      ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 
      : 0;
    plusDI.push(plusDICalc);

    // -DI = (smoothed -DM / smoothed TR) * 100
    const minusDICalc = smoothedTR[i] !== 0 
      ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 
      : 0;
    minusDI.push(minusDICalc);

    // DX = |(+DI - -DI) / (+DI + -DI)| * 100
    const diSum = plusDICalc + minusDICalc;
    const dxCalc = diSum !== 0 
      ? Math.abs((plusDICalc - minusDICalc) / diSum) * 100 
      : 0;
    dx.push(dxCalc);
  }

  // ADX = EMA des DX
  const dxValues = dx.filter(val => val !== null && !isNaN(val));
  const adxEMA = calculateEMA(dxValues, period);

  // Rekonstruiere ADX Array
  const adx = [];
  let adxIndex = 0;
  for (let i = 0; i < dx.length; i++) {
    if (dx[i] === null || isNaN(dx[i])) {
      adx.push(null);
    } else {
      adx.push(adxEMA[adxIndex] || null);
      adxIndex++;
    }
  }

  // Füge null am Anfang hinzu (erste Kerze hat keine Vergleichswerte)
  return {
    adx: [null].concat(adx),
    plusDI: [null].concat(plusDI),
    minusDI: [null].concat(minusDI)
  };
}

/**
 * Berechnet alle Indikatoren für ein Array von Candles
 * 
 * Diese Funktion ist ein Convenience-Wrapper, der alle Indikatoren
 * auf einmal berechnet und in einem strukturierten Objekt zurückgibt.
 * 
 * Wichtig: Indikatoren werden nur berechnet, wenn genug Daten vorhanden sind.
 * Für Indikatoren mit hohen Perioden (z.B. SMA200) werden mehr Daten benötigt.
 * 
 * @param {Array} candles - Array von Candle-Objekten {open, high, low, close, volume, time}
 * @returns {Object} Objekt mit allen berechneten Indikatoren
 */
export function calculateAllIndicators(candles) {
  if (!candles || candles.length === 0) {
    throw new Error('Candles Array darf nicht leer sein');
  }

  // Extrahiere Schlusskurse für Indikatoren, die nur Close-Preise brauchen
  const closes = candles.map(c => c.close);
  const dataLength = closes.length;

  // Berechne Indikatoren nur wenn genug Daten vorhanden sind
  // Verwende try-catch um Fehler abzufangen, falls nicht genug Daten vorhanden sind
  
  let sma20 = null;
  let sma50 = null;
  let sma200 = null;
  let ema12 = null;
  let ema26 = null;
  let ema50 = null;
  let ema200 = null;

  // SMA - benötigt mindestens 'period' Datenpunkte
  if (dataLength >= 20) {
    try {
      sma20 = calculateSMA(closes, 20);
    } catch (e) {
      console.warn('SMA20 konnte nicht berechnet werden:', e.message);
    }
  }
  if (dataLength >= 50) {
    try {
      sma50 = calculateSMA(closes, 50);
    } catch (e) {
      console.warn('SMA50 konnte nicht berechnet werden:', e.message);
    }
  }
  if (dataLength >= 200) {
    try {
      sma200 = calculateSMA(closes, 200);
    } catch (e) {
      console.warn('SMA200 konnte nicht berechnet werden:', e.message);
    }
  }

  // EMA - benötigt mindestens 'period' Datenpunkte
  if (dataLength >= 12) {
    try {
      ema12 = calculateEMA(closes, 12);
    } catch (e) {
      console.warn('EMA12 konnte nicht berechnet werden:', e.message);
    }
  }
  if (dataLength >= 26) {
    try {
      ema26 = calculateEMA(closes, 26);
    } catch (e) {
      console.warn('EMA26 konnte nicht berechnet werden:', e.message);
    }
  }
  if (dataLength >= 50) {
    try {
      ema50 = calculateEMA(closes, 50);
    } catch (e) {
      console.warn('EMA50 konnte nicht berechnet werden:', e.message);
    }
  }
  if (dataLength >= 200) {
    try {
      ema200 = calculateEMA(closes, 200);
    } catch (e) {
      console.warn('EMA200 konnte nicht berechnet werden:', e.message);
    }
  }

  // RSI - benötigt mindestens 15 Datenpunkte (14 + 1)
  let rsi = null;
  if (dataLength >= 15) {
    try {
      rsi = calculateRSI(closes, 14);
    } catch (e) {
      console.warn('RSI konnte nicht berechnet werden:', e.message);
    }
  }

  // MACD - benötigt mindestens 35 Datenpunkte (26 + 9)
  let macd = null;
  if (dataLength >= 35) {
    try {
      macd = calculateMACD(closes, 12, 26, 9);
    } catch (e) {
      console.warn('MACD konnte nicht berechnet werden:', e.message);
    }
  }

  // Bollinger Bands - benötigt mindestens 20 Datenpunkte
  let bollinger = null;
  if (dataLength >= 20) {
    try {
      bollinger = calculateBollingerBands(closes, 20, 2);
    } catch (e) {
      console.warn('Bollinger Bands konnten nicht berechnet werden:', e.message);
    }
  }

  // ATR - benötigt mindestens 15 Datenpunkte (14 + 1)
  let atr = null;
  if (dataLength >= 15) {
    try {
      atr = calculateATR(candles, 14);
    } catch (e) {
      console.warn('ATR konnte nicht berechnet werden:', e.message);
    }
  }

  // ADX - benötigt mindestens 15 Datenpunkte (14 + 1)
  let adx = null;
  if (dataLength >= 15) {
    try {
      adx = calculateADX(candles, 14);
    } catch (e) {
      console.warn('ADX konnte nicht berechnet werden:', e.message);
    }
  }

  return {
    // Moving Averages
    sma: {
      sma20,
      sma50,
      sma200
    },
    ema: {
      ema12,
      ema26,
      ema50,
      ema200
    },
    // Momentum Indikatoren
    rsi,
    macd,
    // Volatilität
    bollinger,
    atr,
    // Trend-Stärke
    adx
  };
}

