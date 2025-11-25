/**
 * Breakout Detection API Routes
 * 
 * Endpoints:
 * - GET /api/breakout/:symbol/:interval - Vollständige Breakout-Analyse
 * - GET /api/breakout/scan/:interval - Scanne alle Coins nach Breakout-Situationen
 */

import express from 'express';
import { getHistoricalData, getTop50Prices } from '../services/binanceApi.js';
import { analyzeBreakout, quickBreakoutCheck } from '../services/breakout.js';

const router = express.Router();

/**
 * GET /api/breakout/:symbol/:interval
 * 
 * Vollständige Breakout-Analyse für einen Coin
 */
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const { lookback = 200 } = req.query;
    
    // Validiere Interval
    const validIntervals = ['15m', '1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}. Erlaubt: ${validIntervals.join(', ')}`
      });
    }
    
    // Hole Candle-Daten
    const candles = await getHistoricalData(symbol, interval, parseInt(lookback));
    
    if (!candles || candles.length < 50) {
      return res.status(400).json({
        error: 'Nicht genug Daten für Analyse'
      });
    }
    
    // Analysiere Breakout
    const analysis = analyzeBreakout(candles);
    
    res.json({
      symbol,
      interval,
      ...analysis
    });
    
  } catch (error) {
    console.error('Breakout analysis error:', error);
    res.status(500).json({
      error: 'Breakout-Analyse fehlgeschlagen',
      message: error.message
    });
  }
});

/**
 * GET /api/breakout/scan/:interval
 * 
 * Scanne alle Top 50 Coins nach Breakout-Situationen
 * Sortiert nach Breakout-Score
 */
router.get('/scan/:interval', async (req, res) => {
  try {
    const { interval } = req.params;
    const { minScore = 40, limit = 20 } = req.query;
    
    const validIntervals = ['15m', '1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}`
      });
    }
    
    console.log(`🔍 Scanning for breakouts (interval: ${interval})...`);
    const startTime = Date.now();
    
    // Hole alle Coins
    const prices = await getTop50Prices();
    const results = [];
    const errors = [];
    
    // Analysiere jeden Coin
    for (const coin of prices) {
      try {
        const candles = await getHistoricalData(coin.symbol, interval, 100);
        
        if (!candles || candles.length < 30) {
          continue;
        }
        
        // Quick Check für Performance
        const quick = quickBreakoutCheck(candles);
        
        if (quick.score >= parseInt(minScore)) {
          // Vollständige Analyse nur für potentielle Breakouts
          const full = analyzeBreakout(candles);
          
          results.push({
            symbol: coin.symbol,
            price: coin.price,
            change24h: coin.change24h,
            breakoutScore: full.score,
            probability: full.probabilityLabel,
            likelyDirection: full.likelyDirection,
            summary: full.summary,
            signalCount: full.signals.length,
            signals: full.signals.map(s => s.type),
            hasActiveBreakout: full.signals.some(s => s.type === 'ACTIVE_BREAKOUT'),
            hasSqueeze: full.signals.some(s => s.type === 'SQUEEZE'),
            hasAccumulation: full.details.volume?.isAccumulating || false
          });
        }
        
        // Kleine Pause um Rate-Limits zu vermeiden
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        errors.push({ symbol: coin.symbol, error: err.message });
      }
    }
    
    // Sortiere nach Score
    results.sort((a, b) => b.breakoutScore - a.breakoutScore);
    
    // Limitiere Ergebnisse
    const limitedResults = results.slice(0, parseInt(limit));
    
    const duration = Date.now() - startTime;
    console.log(`✅ Breakout scan complete in ${duration}ms - Found ${results.length} potential breakouts`);
    
    res.json({
      success: true,
      results: limitedResults,
      meta: {
        scannedCoins: prices.length,
        potentialBreakouts: results.length,
        returnedResults: limitedResults.length,
        minScore: parseInt(minScore),
        interval,
        duration,
        timestamp: new Date().toISOString()
      },
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Breakout scan error:', error);
    res.status(500).json({
      error: 'Breakout-Scan fehlgeschlagen',
      message: error.message
    });
  }
});

export default router;
