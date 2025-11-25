/**
 * Divergenz-Erkennung API Routes
 */

import express from 'express';
import { getHistoricalData } from '../services/binanceApi.js';
import { calculateAllIndicators } from '../services/indicators.js';
import { analyzeDivergences } from '../services/divergence.js';

const router = express.Router();

/**
 * GET /api/divergence/:symbol/:interval
 * 
 * Analysiert Divergenzen für ein Symbol
 * 
 * Query Parameters:
 * - lookback: Wie viele Candles analysieren (default: 100)
 */
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const lookback = parseInt(req.query.lookback) || 100;

    // Validiere Interval
    const validIntervals = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}. Erlaubt: ${validIntervals.join(', ')}`
      });
    }

    // Hole Candle-Daten
    const candles = await getHistoricalData(symbol, interval, Math.min(lookback, 500));

    if (!candles || candles.length < 50) {
      return res.status(400).json({
        error: 'Nicht genug Daten für Divergenz-Analyse (min. 50 Candles)'
      });
    }

    // Berechne Indikatoren
    const indicators = calculateAllIndicators(candles);

    // Analysiere Divergenzen
    const divergenceAnalysis = analyzeDivergences(candles, indicators);

    // Füge Kontext hinzu
    const lastCandle = candles[candles.length - 1];
    const lastRSI = indicators.rsi ? indicators.rsi[indicators.rsi.length - 1] : null;

    res.json({
      symbol,
      interval,
      currentPrice: lastCandle.close,
      currentRSI: lastRSI ? Math.round(lastRSI * 10) / 10 : null,
      analyzedCandles: candles.length,
      ...divergenceAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Divergence analysis error:', error);
    res.status(500).json({
      error: 'Divergenz-Analyse fehlgeschlagen',
      message: error.message
    });
  }
});

export default router;
