/**
 * Multi-Timeframe Analysis Service
 * 
 * Analysiert ein Symbol über mehrere Zeitrahmen und
 * prüft ob alle Timeframes das Signal bestätigen.
 * 
 * Stärkere Signale wenn alle Timeframes übereinstimmen.
 */

import { getHistoricalData } from './binanceApi.js';
import { calculateRecommendations } from './recommendations.js';

/**
 * Analysiert ein Symbol über mehrere Timeframes
 * 
 * @param {string} symbol - Trading Pair (z.B. "BTC")
 * @param {Array} timeframes - Array von Timeframes (default: ['1h', '4h', '1d'])
 * @returns {Object} Multi-Timeframe Analyse
 */
export async function analyzeMultiTimeframe(symbol, timeframes = ['1h', '4h', '1d']) {
  const results = {};
  const errors = [];

  // Limits für verschiedene Timeframes (30 Tage Daten)
  const intervalLimits = {
    '15m': 2880,
    '30m': 1440,
    '1h': 720,
    '2h': 360,
    '4h': 180,
    '6h': 120,
    '12h': 60,
    '1d': 30,
    '3d': 10,
    '1w': 12
  };

  // Analysiere jeden Timeframe
  for (const tf of timeframes) {
    try {
      const limit = intervalLimits[tf] || 180;
      const candles = await getHistoricalData(symbol, tf, limit);
      const rec = calculateRecommendations(candles);

      results[tf] = {
        score: rec.score,
        recommendation: rec.recommendation,
        signalStatus: rec.signalStatus,
        entryQuality: rec.entryQuality,
        warnings: rec.warnings,
        indicators: {
          rsi: rec.indicators.rsi,
          adx: rec.indicators.adx,
          macdHistogram: rec.indicators.macdHistogram
        },
        breakdown: rec.breakdown
      };
    } catch (error) {
      errors.push({ timeframe: tf, error: error.message });
      results[tf] = null;
    }
  }

  // Berechne Alignment und Confidence
  const validResults = Object.entries(results).filter(([_, v]) => v !== null);
  
  if (validResults.length === 0) {
    throw new Error('Keine Timeframe-Analyse erfolgreich');
  }

  // Prüfe ob alle Timeframes übereinstimmen
  const allBullish = validResults.every(([_, r]) => 
    r.recommendation === 'STRONG_BUY' || r.recommendation === 'BUY'
  );
  
  const allBearish = validResults.every(([_, r]) => 
    r.recommendation === 'SELL' || r.recommendation === 'STRONG_SELL'
  );

  const allStrongBuy = validResults.every(([_, r]) => 
    r.recommendation === 'STRONG_BUY'
  );

  // Durchschnittlicher Score
  const avgScore = validResults.reduce((sum, [_, r]) => sum + r.score, 0) / validResults.length;

  // Durchschnittliche Entry Quality
  const avgEntryQuality = validResults.reduce((sum, [_, r]) => sum + (r.entryQuality || 50), 0) / validResults.length;

  // Confidence Level basierend auf Alignment
  let confidence = 'LOW';
  let alignmentType = 'MIXED';

  if (allStrongBuy) {
    confidence = 'VERY_HIGH';
    alignmentType = 'ALL_STRONG_BUY';
  } else if (allBullish) {
    confidence = 'HIGH';
    alignmentType = 'ALL_BULLISH';
  } else if (allBearish) {
    confidence = 'HIGH';
    alignmentType = 'ALL_BEARISH';
  } else {
    // Prüfe partielle Übereinstimmung
    const bullishCount = validResults.filter(([_, r]) => 
      r.recommendation === 'STRONG_BUY' || r.recommendation === 'BUY'
    ).length;
    
    const bearishCount = validResults.filter(([_, r]) => 
      r.recommendation === 'SELL' || r.recommendation === 'STRONG_SELL'
    ).length;

    if (bullishCount > bearishCount) {
      confidence = bullishCount >= validResults.length - 1 ? 'MEDIUM' : 'LOW';
      alignmentType = 'MOSTLY_BULLISH';
    } else if (bearishCount > bullishCount) {
      confidence = bearishCount >= validResults.length - 1 ? 'MEDIUM' : 'LOW';
      alignmentType = 'MOSTLY_BEARISH';
    } else {
      confidence = 'LOW';
      alignmentType = 'CONFLICTING';
    }
  }

  // Sammle alle Warnungen
  const allWarnings = [];
  validResults.forEach(([tf, r]) => {
    if (r.warnings && r.warnings.length > 0) {
      r.warnings.forEach(w => {
        allWarnings.push({
          ...w,
          timeframe: tf
        });
      });
    }
  });

  // Dedupliziere ähnliche Warnungen
  const uniqueWarnings = allWarnings.reduce((acc, warning) => {
    const existing = acc.find(w => w.type === warning.type);
    if (!existing) {
      acc.push(warning);
    }
    return acc;
  }, []);

  // Bestimme empfohlene Aktion
  let recommendedAction = 'WAIT';
  let actionReason = '';

  if (allStrongBuy && avgEntryQuality >= 55) {
    recommendedAction = 'STRONG_BUY_NOW';
    actionReason = 'Alle Timeframes Strong Buy + guter Entry';
  } else if (allStrongBuy && avgEntryQuality < 55) {
    recommendedAction = 'WATCH_FOR_PULLBACK';
    actionReason = 'Alle Timeframes Strong Buy, aber Entry Quality niedrig - warte auf Pullback';
  } else if (allBullish && avgEntryQuality >= 50) {
    recommendedAction = 'BUY_PARTIAL';
    actionReason = 'Alle Timeframes bullish, Teilposition möglich';
  } else if (allBullish) {
    recommendedAction = 'WATCH';
    actionReason = 'Alle Timeframes bullish, aber schlechter Entry - beobachten';
  } else if (allBearish) {
    recommendedAction = 'SELL';
    actionReason = 'Alle Timeframes bearish';
  } else if (alignmentType === 'CONFLICTING') {
    recommendedAction = 'WAIT';
    actionReason = 'Widersprüchliche Signale zwischen Timeframes';
  } else if (alignmentType === 'MOSTLY_BULLISH') {
    recommendedAction = 'WATCH';
    actionReason = 'Mehrheitlich bullish, aber nicht alle Timeframes';
  } else {
    recommendedAction = 'WAIT';
    actionReason = 'Keine klare Richtung';
  }

  // Wenn es High-Severity Warnungen gibt, downgrade die Empfehlung
  const hasHighWarnings = uniqueWarnings.some(w => w.severity === 'HIGH');
  if (hasHighWarnings && recommendedAction === 'STRONG_BUY_NOW') {
    recommendedAction = 'WATCH_FOR_PULLBACK';
    actionReason += ' (herabgestuft wegen Überhitzungs-Warnungen)';
  }

  return {
    symbol,
    timeframes: results,
    summary: {
      avgScore: Math.round(avgScore * 10) / 10,
      avgEntryQuality: Math.round(avgEntryQuality * 10) / 10,
      confidence,
      alignmentType,
      allBullish,
      allBearish,
      allStrongBuy
    },
    recommendedAction,
    actionReason,
    warnings: uniqueWarnings,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  };
}

/**
 * Quick Check: Prüft nur ob alle Timeframes aligned sind
 * 
 * @param {string} symbol - Trading Pair
 * @returns {Object} Quick alignment check
 */
export async function quickAlignmentCheck(symbol) {
  const timeframes = ['1h', '4h', '1d'];
  const results = [];

  for (const tf of timeframes) {
    try {
      const limit = tf === '1h' ? 200 : tf === '4h' ? 100 : 30;
      const candles = await getHistoricalData(symbol, tf, limit);
      const rec = calculateRecommendations(candles);
      results.push({
        tf,
        score: rec.score,
        recommendation: rec.recommendation
      });
    } catch (error) {
      results.push({ tf, error: error.message });
    }
  }

  const valid = results.filter(r => !r.error);
  const allBullish = valid.every(r => r.score >= 50);
  const allStrongBuy = valid.every(r => r.recommendation === 'STRONG_BUY');

  return {
    symbol,
    results,
    aligned: allBullish || valid.every(r => r.score < 50),
    allBullish,
    allStrongBuy,
    avgScore: valid.reduce((s, r) => s + r.score, 0) / valid.length
  };
}

export default {
  analyzeMultiTimeframe,
  quickAlignmentCheck
};
