/**
 * Divergenz-Erkennung Service
 * 
 * Erkennt Divergenzen zwischen Preis und Indikatoren (RSI, MACD).
 * Divergenzen sind starke Umkehrsignale.
 * 
 * Typen:
 * - Bullish Divergenz: Preis macht tieferes Tief, Indikator macht höheres Tief → Kaufsignal
 * - Bearish Divergenz: Preis macht höheres Hoch, Indikator macht tieferes Hoch → Verkaufssignal
 * - Hidden Bullish: Preis macht höheres Tief, Indikator macht tieferes Tief → Trend-Fortsetzung
 * - Hidden Bearish: Preis macht tieferes Hoch, Indikator macht höheres Hoch → Trend-Fortsetzung
 */

/**
 * Findet lokale Hochs und Tiefs in einem Array
 * 
 * @param {Array} data - Array von Werten
 * @param {number} lookback - Wie viele Kerzen links/rechts prüfen (default: 5)
 * @returns {Object} { highs: [{index, value}], lows: [{index, value}] }
 */
function findPivotPoints(data, lookback = 5) {
  const highs = [];
  const lows = [];

  if (!data || data.length < lookback * 2 + 1) {
    return { highs, lows };
  }

  for (let i = lookback; i < data.length - lookback; i++) {
    const current = data[i];
    if (current === null || current === undefined) continue;

    let isHigh = true;
    let isLow = true;

    // Prüfe ob aktueller Punkt höher/tiefer als alle Nachbarn ist
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      const neighbor = data[j];
      if (neighbor === null || neighbor === undefined) continue;

      if (neighbor >= current) isHigh = false;
      if (neighbor <= current) isLow = false;
    }

    if (isHigh) {
      highs.push({ index: i, value: current });
    }
    if (isLow) {
      lows.push({ index: i, value: current });
    }
  }

  return { highs, lows };
}

/**
 * Erkennt RSI Divergenzen
 * 
 * @param {Array} candles - Array von Candle-Objekten
 * @param {Array} rsiValues - Array von RSI-Werten
 * @param {number} lookbackPeriod - Wie weit zurückschauen (default: 50)
 * @returns {Object} Divergenz-Analyse
 */
export function detectRSIDivergence(candles, rsiValues, lookbackPeriod = 50) {
  if (!candles || !rsiValues || candles.length < lookbackPeriod) {
    return { found: false, divergences: [] };
  }

  // Nur die letzten X Candles analysieren
  const startIndex = Math.max(0, candles.length - lookbackPeriod);
  const recentCandles = candles.slice(startIndex);
  const recentRSI = rsiValues.slice(startIndex);

  // Extrahiere Close-Preise
  const prices = recentCandles.map(c => c.close);

  // Finde Pivot-Punkte
  const pricePivots = findPivotPoints(prices, 3);
  const rsiPivots = findPivotPoints(recentRSI, 3);

  const divergences = [];

  // Prüfe auf Bullish Divergenz (bei Tiefs)
  // Preis macht tieferes Tief, RSI macht höheres Tief
  if (pricePivots.lows.length >= 2 && rsiPivots.lows.length >= 2) {
    const priceLows = pricePivots.lows.slice(-3); // Letzte 3 Tiefs
    const rsiLows = rsiPivots.lows.slice(-3);

    for (let i = 1; i < priceLows.length; i++) {
      const prevPriceLow = priceLows[i - 1];
      const currPriceLow = priceLows[i];

      // Finde korrespondierende RSI-Tiefs (nahe am gleichen Index)
      const prevRSILow = rsiLows.find(r => Math.abs(r.index - prevPriceLow.index) <= 3);
      const currRSILow = rsiLows.find(r => Math.abs(r.index - currPriceLow.index) <= 3);

      if (prevRSILow && currRSILow) {
        // Bullish Divergenz: Preis tiefer, RSI höher
        if (currPriceLow.value < prevPriceLow.value && currRSILow.value > prevRSILow.value) {
          divergences.push({
            type: 'BULLISH',
            indicator: 'RSI',
            strength: calculateDivergenceStrength(
              prevPriceLow.value, currPriceLow.value,
              prevRSILow.value, currRSILow.value
            ),
            description: 'Preis macht tieferes Tief, RSI macht höheres Tief',
            signal: 'Mögliche Trendumkehr nach oben',
            pricePoints: [
              { index: startIndex + prevPriceLow.index, value: prevPriceLow.value },
              { index: startIndex + currPriceLow.index, value: currPriceLow.value }
            ],
            indicatorPoints: [
              { index: startIndex + prevRSILow.index, value: prevRSILow.value },
              { index: startIndex + currRSILow.index, value: currRSILow.value }
            ],
            candlesAgo: recentCandles.length - currPriceLow.index
          });
        }

        // Hidden Bullish Divergenz: Preis höher, RSI tiefer (Trend-Fortsetzung)
        if (currPriceLow.value > prevPriceLow.value && currRSILow.value < prevRSILow.value) {
          divergences.push({
            type: 'HIDDEN_BULLISH',
            indicator: 'RSI',
            strength: calculateDivergenceStrength(
              prevPriceLow.value, currPriceLow.value,
              prevRSILow.value, currRSILow.value
            ),
            description: 'Preis macht höheres Tief, RSI macht tieferes Tief',
            signal: 'Aufwärtstrend könnte sich fortsetzen',
            pricePoints: [
              { index: startIndex + prevPriceLow.index, value: prevPriceLow.value },
              { index: startIndex + currPriceLow.index, value: currPriceLow.value }
            ],
            indicatorPoints: [
              { index: startIndex + prevRSILow.index, value: prevRSILow.value },
              { index: startIndex + currRSILow.index, value: currRSILow.value }
            ],
            candlesAgo: recentCandles.length - currPriceLow.index
          });
        }
      }
    }
  }

  // Prüfe auf Bearish Divergenz (bei Hochs)
  // Preis macht höheres Hoch, RSI macht tieferes Hoch
  if (pricePivots.highs.length >= 2 && rsiPivots.highs.length >= 2) {
    const priceHighs = pricePivots.highs.slice(-3);
    const rsiHighs = rsiPivots.highs.slice(-3);

    for (let i = 1; i < priceHighs.length; i++) {
      const prevPriceHigh = priceHighs[i - 1];
      const currPriceHigh = priceHighs[i];

      const prevRSIHigh = rsiHighs.find(r => Math.abs(r.index - prevPriceHigh.index) <= 3);
      const currRSIHigh = rsiHighs.find(r => Math.abs(r.index - currPriceHigh.index) <= 3);

      if (prevRSIHigh && currRSIHigh) {
        // Bearish Divergenz: Preis höher, RSI tiefer
        if (currPriceHigh.value > prevPriceHigh.value && currRSIHigh.value < prevRSIHigh.value) {
          divergences.push({
            type: 'BEARISH',
            indicator: 'RSI',
            strength: calculateDivergenceStrength(
              prevPriceHigh.value, currPriceHigh.value,
              prevRSIHigh.value, currRSIHigh.value
            ),
            description: 'Preis macht höheres Hoch, RSI macht tieferes Hoch',
            signal: 'Mögliche Trendumkehr nach unten',
            pricePoints: [
              { index: startIndex + prevPriceHigh.index, value: prevPriceHigh.value },
              { index: startIndex + currPriceHigh.index, value: currPriceHigh.value }
            ],
            indicatorPoints: [
              { index: startIndex + prevRSIHigh.index, value: prevRSIHigh.value },
              { index: startIndex + currRSIHigh.index, value: currRSIHigh.value }
            ],
            candlesAgo: recentCandles.length - currPriceHigh.index
          });
        }

        // Hidden Bearish Divergenz: Preis tiefer, RSI höher (Abwärtstrend-Fortsetzung)
        if (currPriceHigh.value < prevPriceHigh.value && currRSIHigh.value > prevRSIHigh.value) {
          divergences.push({
            type: 'HIDDEN_BEARISH',
            indicator: 'RSI',
            strength: calculateDivergenceStrength(
              prevPriceHigh.value, currPriceHigh.value,
              prevRSIHigh.value, currRSIHigh.value
            ),
            description: 'Preis macht tieferes Hoch, RSI macht höheres Hoch',
            signal: 'Abwärtstrend könnte sich fortsetzen',
            pricePoints: [
              { index: startIndex + prevPriceHigh.index, value: prevPriceHigh.value },
              { index: startIndex + currPriceHigh.index, value: currPriceHigh.value }
            ],
            indicatorPoints: [
              { index: startIndex + prevRSIHigh.index, value: prevRSIHigh.value },
              { index: startIndex + currRSIHigh.index, value: currRSIHigh.value }
            ],
            candlesAgo: recentCandles.length - currPriceHigh.index
          });
        }
      }
    }
  }

  // Filtere nur relevante Divergenzen (nicht zu alt)
  const recentDivergences = divergences.filter(d => d.candlesAgo <= 10);

  // Sortiere nach Stärke
  recentDivergences.sort((a, b) => b.strength - a.strength);

  return {
    found: recentDivergences.length > 0,
    divergences: recentDivergences,
    summary: summarizeDivergences(recentDivergences)
  };
}

/**
 * Erkennt MACD Divergenzen
 * 
 * @param {Array} candles - Array von Candle-Objekten
 * @param {Array} macdHistogram - Array von MACD Histogram-Werten
 * @param {number} lookbackPeriod - Wie weit zurückschauen
 * @returns {Object} Divergenz-Analyse
 */
export function detectMACDDivergence(candles, macdHistogram, lookbackPeriod = 50) {
  if (!candles || !macdHistogram || candles.length < lookbackPeriod) {
    return { found: false, divergences: [] };
  }

  const startIndex = Math.max(0, candles.length - lookbackPeriod);
  const recentCandles = candles.slice(startIndex);
  const recentMACD = macdHistogram.slice(startIndex);

  const prices = recentCandles.map(c => c.close);

  const pricePivots = findPivotPoints(prices, 3);
  const macdPivots = findPivotPoints(recentMACD, 3);

  const divergences = [];

  // Bullish Divergenz bei Tiefs
  if (pricePivots.lows.length >= 2 && macdPivots.lows.length >= 2) {
    const priceLows = pricePivots.lows.slice(-3);
    const macdLows = macdPivots.lows.slice(-3);

    for (let i = 1; i < priceLows.length; i++) {
      const prevPriceLow = priceLows[i - 1];
      const currPriceLow = priceLows[i];

      const prevMACDLow = macdLows.find(m => Math.abs(m.index - prevPriceLow.index) <= 5);
      const currMACDLow = macdLows.find(m => Math.abs(m.index - currPriceLow.index) <= 5);

      if (prevMACDLow && currMACDLow) {
        if (currPriceLow.value < prevPriceLow.value && currMACDLow.value > prevMACDLow.value) {
          divergences.push({
            type: 'BULLISH',
            indicator: 'MACD',
            strength: calculateDivergenceStrength(
              prevPriceLow.value, currPriceLow.value,
              prevMACDLow.value, currMACDLow.value
            ),
            description: 'Preis macht tieferes Tief, MACD macht höheres Tief',
            signal: 'Mögliche Trendumkehr nach oben',
            candlesAgo: recentCandles.length - currPriceLow.index
          });
        }
      }
    }
  }

  // Bearish Divergenz bei Hochs
  if (pricePivots.highs.length >= 2 && macdPivots.highs.length >= 2) {
    const priceHighs = pricePivots.highs.slice(-3);
    const macdHighs = macdPivots.highs.slice(-3);

    for (let i = 1; i < priceHighs.length; i++) {
      const prevPriceHigh = priceHighs[i - 1];
      const currPriceHigh = priceHighs[i];

      const prevMACDHigh = macdHighs.find(m => Math.abs(m.index - prevPriceHigh.index) <= 5);
      const currMACDHigh = macdHighs.find(m => Math.abs(m.index - currPriceHigh.index) <= 5);

      if (prevMACDHigh && currMACDHigh) {
        if (currPriceHigh.value > prevPriceHigh.value && currMACDHigh.value < prevMACDHigh.value) {
          divergences.push({
            type: 'BEARISH',
            indicator: 'MACD',
            strength: calculateDivergenceStrength(
              prevPriceHigh.value, currPriceHigh.value,
              prevMACDHigh.value, currMACDHigh.value
            ),
            description: 'Preis macht höheres Hoch, MACD macht tieferes Hoch',
            signal: 'Mögliche Trendumkehr nach unten',
            candlesAgo: recentCandles.length - currPriceHigh.index
          });
        }
      }
    }
  }

  const recentDivergences = divergences.filter(d => d.candlesAgo <= 10);
  recentDivergences.sort((a, b) => b.strength - a.strength);

  return {
    found: recentDivergences.length > 0,
    divergences: recentDivergences,
    summary: summarizeDivergences(recentDivergences)
  };
}

/**
 * Berechnet die Stärke einer Divergenz
 * Je größer die Differenz zwischen Preis und Indikator, desto stärker
 */
function calculateDivergenceStrength(prevPrice, currPrice, prevIndicator, currIndicator) {
  // Prozentuale Änderung
  const priceChange = Math.abs((currPrice - prevPrice) / prevPrice);
  const indicatorChange = Math.abs((currIndicator - prevIndicator) / (Math.abs(prevIndicator) || 1));

  // Stärke basiert auf der Summe der Änderungen
  const rawStrength = (priceChange + indicatorChange) * 100;

  // Normalisiere auf 0-100
  return Math.min(100, Math.max(0, rawStrength * 5));
}

/**
 * Erstellt eine Zusammenfassung der gefundenen Divergenzen
 */
function summarizeDivergences(divergences) {
  if (divergences.length === 0) {
    return {
      hasDivergence: false,
      primarySignal: null,
      message: 'Keine Divergenz erkannt'
    };
  }

  const bullish = divergences.filter(d => d.type === 'BULLISH' || d.type === 'HIDDEN_BULLISH');
  const bearish = divergences.filter(d => d.type === 'BEARISH' || d.type === 'HIDDEN_BEARISH');

  const strongest = divergences[0];

  let primarySignal = 'NEUTRAL';
  let message = '';

  if (bullish.length > bearish.length) {
    primarySignal = 'BULLISH';
    message = `${bullish.length} bullishe Divergenz(en) erkannt - mögliche Umkehr nach oben`;
  } else if (bearish.length > bullish.length) {
    primarySignal = 'BEARISH';
    message = `${bearish.length} bearishe Divergenz(en) erkannt - mögliche Umkehr nach unten`;
  } else if (divergences.length > 0) {
    primarySignal = strongest.type.includes('BULLISH') ? 'BULLISH' : 'BEARISH';
    message = `Gemischte Divergenzen - stärkste: ${strongest.type}`;
  }

  return {
    hasDivergence: true,
    primarySignal,
    message,
    strongestDivergence: strongest,
    bullishCount: bullish.length,
    bearishCount: bearish.length
  };
}

/**
 * Hauptfunktion: Analysiert alle Divergenzen für ein Symbol
 * 
 * @param {Array} candles - Candle-Daten
 * @param {Object} indicators - Berechnete Indikatoren
 * @returns {Object} Komplette Divergenz-Analyse
 */
export function analyzeDivergences(candles, indicators) {
  if (!candles || !indicators) {
    return {
      rsi: { found: false, divergences: [] },
      macd: { found: false, divergences: [] },
      combined: {
        hasDivergence: false,
        signal: 'NEUTRAL',
        score: 0,
        message: 'Keine Daten für Divergenz-Analyse'
      }
    };
  }

  // RSI Divergenz
  const rsiDivergence = indicators.rsi 
    ? detectRSIDivergence(candles, indicators.rsi, 50)
    : { found: false, divergences: [] };

  // MACD Divergenz
  const macdDivergence = indicators.macd?.histogram
    ? detectMACDDivergence(candles, indicators.macd.histogram, 50)
    : { found: false, divergences: [] };

  // Kombinierte Analyse
  const allDivergences = [
    ...rsiDivergence.divergences,
    ...macdDivergence.divergences
  ];

  let combinedSignal = 'NEUTRAL';
  let combinedScore = 50;
  let combinedMessage = 'Keine Divergenz erkannt';

  if (allDivergences.length > 0) {
    const bullish = allDivergences.filter(d => d.type === 'BULLISH' || d.type === 'HIDDEN_BULLISH');
    const bearish = allDivergences.filter(d => d.type === 'BEARISH' || d.type === 'HIDDEN_BEARISH');

    // Berechne Score basierend auf Anzahl und Stärke
    const bullishScore = bullish.reduce((sum, d) => sum + d.strength, 0);
    const bearishScore = bearish.reduce((sum, d) => sum + d.strength, 0);

    if (bullishScore > bearishScore) {
      combinedSignal = 'BULLISH';
      combinedScore = Math.min(100, 50 + bullishScore / 2);
      
      if (bullish.some(d => d.type === 'BULLISH')) {
        combinedMessage = '🟢 Bullishe Divergenz erkannt - mögliche Trendumkehr nach oben';
      } else {
        combinedMessage = '🟢 Hidden Bullish Divergenz - Aufwärtstrend könnte weitergehen';
      }
    } else if (bearishScore > bullishScore) {
      combinedSignal = 'BEARISH';
      combinedScore = Math.max(0, 50 - bearishScore / 2);
      
      if (bearish.some(d => d.type === 'BEARISH')) {
        combinedMessage = '🔴 Bearishe Divergenz erkannt - mögliche Trendumkehr nach unten';
      } else {
        combinedMessage = '🔴 Hidden Bearish Divergenz - Abwärtstrend könnte weitergehen';
      }
    }
  }

  // Prüfe ob RSI und MACD beide gleiche Divergenz zeigen (sehr starkes Signal)
  const rsiBullish = rsiDivergence.divergences.some(d => d.type === 'BULLISH');
  const macdBullish = macdDivergence.divergences.some(d => d.type === 'BULLISH');
  const rsiBearish = rsiDivergence.divergences.some(d => d.type === 'BEARISH');
  const macdBearish = macdDivergence.divergences.some(d => d.type === 'BEARISH');

  let confirmation = false;
  if (rsiBullish && macdBullish) {
    confirmation = true;
    combinedMessage = '🟢🟢 STARKES SIGNAL: RSI + MACD zeigen bullishe Divergenz!';
    combinedScore = Math.min(100, combinedScore + 15);
  } else if (rsiBearish && macdBearish) {
    confirmation = true;
    combinedMessage = '🔴🔴 STARKES SIGNAL: RSI + MACD zeigen bearishe Divergenz!';
    combinedScore = Math.max(0, combinedScore - 15);
  }

  return {
    rsi: rsiDivergence,
    macd: macdDivergence,
    combined: {
      hasDivergence: allDivergences.length > 0,
      signal: combinedSignal,
      score: Math.round(combinedScore),
      message: combinedMessage,
      confirmation,
      totalDivergences: allDivergences.length
    }
  };
}

export default {
  detectRSIDivergence,
  detectMACDDivergence,
  analyzeDivergences
};
