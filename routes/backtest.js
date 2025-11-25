/**
 * Backtest API Routes
 * 
 * Endpunkte für Backtesting der Trading-Signale
 */

import express from 'express';
import { runBacktest, runMultiSymbolBacktest, compareStrategies } from '../services/backtest.js';

const router = express.Router();

/**
 * GET /api/backtest/:symbol/:interval
 * 
 * Führt Backtest für ein einzelnes Symbol durch
 * 
 * Query Parameters:
 * - lookbackCandles: Anzahl Candles (default: 500)
 * - holdPeriods: Halteperiode nach Signal (default: 24)
 * - minScore: Minimum Score für Signal (default: 60)
 * - signalType: STRONG_BUY, BUY, STRONG_BUY_NOW (default: STRONG_BUY)
 */
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const { 
      lookbackCandles = 500, 
      holdPeriods = 24, 
      minScore = 60,
      signalType = 'STRONG_BUY'
    } = req.query;

    // Validiere Interval
    const validIntervals = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ 
        error: `Ungültiges Interval. Erlaubt: ${validIntervals.join(', ')}` 
      });
    }

    const result = await runBacktest(symbol, interval, {
      lookbackCandles: parseInt(lookbackCandles),
      holdPeriods: parseInt(holdPeriods),
      minScore: parseFloat(minScore),
      signalType
    });

    res.json(result);
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ 
      error: 'Backtest fehlgeschlagen',
      message: error.message 
    });
  }
});

/**
 * POST /api/backtest/multi
 * 
 * Führt Backtest für mehrere Symbole durch
 * 
 * Body:
 * {
 *   symbols: ["BTC", "ETH", ...],
 *   interval: "4h",
 *   options: { lookbackCandles, holdPeriods, minScore, signalType }
 * }
 */
router.post('/multi', async (req, res) => {
  try {
    const { symbols, interval, options = {} } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ 
        error: 'symbols Array ist erforderlich' 
      });
    }

    if (!interval) {
      return res.status(400).json({ 
        error: 'interval ist erforderlich' 
      });
    }

    // Limit auf 20 Symbole
    const limitedSymbols = symbols.slice(0, 20);

    const result = await runMultiSymbolBacktest(limitedSymbols, interval, options);

    res.json(result);
  } catch (error) {
    console.error('Multi-symbol backtest error:', error);
    res.status(500).json({ 
      error: 'Multi-Symbol Backtest fehlgeschlagen',
      message: error.message 
    });
  }
});

/**
 * GET /api/backtest/compare/:symbol/:interval
 * 
 * Vergleicht verschiedene Signal-Strategien
 */
router.get('/compare/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const { lookbackCandles = 500, holdPeriods = 24 } = req.query;

    const result = await compareStrategies(symbol, interval, {
      lookbackCandles: parseInt(lookbackCandles),
      holdPeriods: parseInt(holdPeriods)
    });

    res.json(result);
  } catch (error) {
    console.error('Strategy comparison error:', error);
    res.status(500).json({ 
      error: 'Strategie-Vergleich fehlgeschlagen',
      message: error.message 
    });
  }
});

export default router;
