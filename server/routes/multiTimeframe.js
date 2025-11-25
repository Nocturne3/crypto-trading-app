/**
 * Multi-Timeframe Analysis API Routes
 */

import express from 'express';
import { analyzeMultiTimeframe, quickAlignmentCheck } from '../services/multiTimeframe.js';

const router = express.Router();

/**
 * GET /api/multi-timeframe/:symbol
 * 
 * Vollständige Multi-Timeframe Analyse
 * 
 * Query Parameters:
 * - timeframes: Komma-separierte Liste (default: 1h,4h,1d)
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframes } = req.query;

    const tfArray = timeframes 
      ? timeframes.split(',').map(t => t.trim())
      : ['1h', '4h', '1d'];

    // Validiere Timeframes
    const validIntervals = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'];
    const invalidTf = tfArray.find(tf => !validIntervals.includes(tf));
    if (invalidTf) {
      return res.status(400).json({ 
        error: `Ungültiger Timeframe: ${invalidTf}. Erlaubt: ${validIntervals.join(', ')}` 
      });
    }

    const result = await analyzeMultiTimeframe(symbol, tfArray);

    res.json(result);
  } catch (error) {
    console.error('Multi-timeframe analysis error:', error);
    res.status(500).json({ 
      error: 'Multi-Timeframe Analyse fehlgeschlagen',
      message: error.message 
    });
  }
});

/**
 * GET /api/multi-timeframe/quick/:symbol
 * 
 * Schneller Alignment-Check
 */
router.get('/quick/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await quickAlignmentCheck(symbol);
    res.json(result);
  } catch (error) {
    console.error('Quick alignment check error:', error);
    res.status(500).json({ 
      error: 'Quick Check fehlgeschlagen',
      message: error.message 
    });
  }
});

export default router;
