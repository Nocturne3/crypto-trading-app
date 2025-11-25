/**
 * Pattern Detection API Routes
 * 
 * Endpoints:
 * - GET /api/patterns/:symbol/:interval - Vollständige Pattern-Analyse
 * - GET /api/patterns/:symbol/:interval/sr - Nur Support/Resistance
 */

import express from 'express';
import { getHistoricalData } from '../services/binanceApi.js';
import { analyzePatterns, calculateSupportResistance } from '../services/patterns.js';

const router = express.Router();

/**
 * GET /api/patterns/:symbol/:interval
 * 
 * Vollständige Pattern-Analyse inkl. S/R und Double Bottom/Top
 */
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const lookback = parseInt(req.query.lookback) || 200;

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
        error: 'Nicht genug Daten für Pattern-Analyse (min. 50 Candles)'
      });
    }

    // Analysiere Pattern
    const analysis = analyzePatterns(candles);

    res.json({
      symbol,
      interval,
      currentPrice: candles[candles.length - 1].close,
      analyzedCandles: candles.length,
      ...analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({
      error: 'Pattern-Analyse fehlgeschlagen',
      message: error.message
    });
  }
});

/**
 * GET /api/patterns/:symbol/:interval/sr
 * 
 * Nur Support/Resistance Levels
 */
router.get('/:symbol/:interval/sr', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const lookback = parseInt(req.query.lookback) || 200;

    const validIntervals = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}`
      });
    }

    const candles = await getHistoricalData(symbol, interval, Math.min(lookback, 500));

    if (!candles || candles.length < 50) {
      return res.status(400).json({
        error: 'Nicht genug Daten'
      });
    }

    const sr = calculateSupportResistance(candles);

    res.json({
      symbol,
      interval,
      ...sr,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('S/R analysis error:', error);
    res.status(500).json({
      error: 'Support/Resistance Analyse fehlgeschlagen',
      message: error.message
    });
  }
});

export default router;
