import express from 'express';
import { getHistoricalData } from '../services/binanceApi.js';
import { calculateRecommendations } from '../services/recommendations.js';
import { calculateAllIndicators } from '../services/indicators.js';

const router = express.Router();

/**
 * GET /api/analysis/:symbol/:interval
 * 
 * Berechnet vollständige technische Analyse für ein Symbol
 * 
 * @param {string} symbol - Crypto Symbol (z.B. BTC, ETH)
 * @param {string} interval - Zeitintervall (15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 3d, 1w)
 * 
 * @returns {Object} {
 *   recommendations: {score, recommendation, breakdown, stopLoss, ...},
 *   candles: Array von Candle-Daten,
 *   indicators: Alle berechneten Indikatoren
 * }
 */
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    
    // Validiere Interval
    const validIntervals = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ 
        error: `Ungültiges Interval. Erlaubt: ${validIntervals.join(', ')}` 
      });
    }

    // Hole historische Daten (30 Tage für bessere Trend-Erkennung)
    // Berechne Limit basierend auf Interval
    let limit = 720; // Standard für 1h (30 Tage)
    const intervalLimits = {
      '15m': 2880,  // 30 Tage * 96 (15m Candles pro Tag)
      '30m': 1440,  // 30 Tage * 48 (30m Candles pro Tag)
      '1h': 720,    // 30 Tage * 24 (1h Candles pro Tag)
      '2h': 360,    // 30 Tage * 12 (2h Candles pro Tag)
      '4h': 180,    // 30 Tage * 6 (4h Candles pro Tag)
      '6h': 120,    // 30 Tage * 4 (6h Candles pro Tag)
      '12h': 60,    // 30 Tage * 2 (12h Candles pro Tag)
      '1d': 30,     // 30 Tage
      '3d': 10,     // 30 Tage
      '1w': 12      // ~12 Wochen (84 Tage)
    };
    limit = intervalLimits[interval] || 720;

    // Hole historische Daten (getHistoricalData gibt bereits formatiertes Format zurück)
    const candles = await getHistoricalData(symbol, interval, limit);

    // Berechne alle Indikatoren
    const indicators = calculateAllIndicators(candles);

    // Berechne Recommendations
    const recommendations = calculateRecommendations(candles);

    res.json({
      symbol,
      interval,
      recommendations,
      candles,
      indicators, // Alle Indikatoren für Charts
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error calculating analysis:', error);
    res.status(500).json({ 
      error: 'Failed to calculate analysis',
      message: error.message 
    });
  }
});

export default router;

