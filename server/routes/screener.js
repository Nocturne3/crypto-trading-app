/**
 * Screener API Routes
 * 
 * Endpoints:
 * - GET /api/screener - Vollständiger Screener mit Filtern
 * - GET /api/screener/quick - Schneller Screener für Dashboard
 * - GET /api/screener/presets - Verfügbare Filter-Presets
 * - GET /api/screener/status - Cache und Rate-Limit Status
 */

import express from 'express';
import { runScreener, runQuickScreener, FILTER_PRESETS } from '../services/screener.js';
import { getCacheStats, getRateLimitStatus, clearCache } from '../services/binanceApi.js';

const router = express.Router();

/**
 * GET /api/screener
 * 
 * Vollständiger Screener mit Filtern
 * 
 * Query Parameters:
 * - preset: Filter-Preset (STRONG_BUY, PULLBACK_ENTRY, etc.)
 * - interval: Timeframe (1h, 4h, 1d) - default: 4h
 * - sortBy: Sortierfeld (score, entryQuality, rsi, change24h) - default: score
 * - sortOrder: asc oder desc - default: desc
 * - limit: Max Ergebnisse - default: 50
 * 
 * Custom Filter (Query Params):
 * - minScore, maxScore
 * - minEntryQuality
 * - minRSI, maxRSI
 * - minADX, maxADX
 * - minChange24h, maxChange24h
 * - hasBullishDivergence (true/false)
 * - hasDoubleBottom (true/false)
 * - doubleBottomConfirmed (true/false)
 * - nearSupport (true/false)
 * - maxWarnings
 */
router.get('/', async (req, res) => {
  try {
    const {
      preset,
      interval = '4h',
      sortBy = 'score',
      sortOrder = 'desc',
      limit = 50,
      // Custom Filters
      minScore,
      maxScore,
      minEntryQuality,
      minRSI,
      maxRSI,
      minADX,
      maxADX,
      minChange24h,
      maxChange24h,
      hasBullishDivergence,
      hasBearishDivergence,
      hasDoubleBottom,
      doubleBottomConfirmed,
      hasDoubleTop,
      nearSupport,
      nearResistance,
      maxDistanceToSupport,
      maxWarnings,
      noWarnings
    } = req.query;

    // Validiere Interval
    const validIntervals = ['1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}. Erlaubt: ${validIntervals.join(', ')}`
      });
    }

    // Baue Custom Filter
    const customFilters = {};
    
    if (minScore !== undefined) customFilters.minScore = parseFloat(minScore);
    if (maxScore !== undefined) customFilters.maxScore = parseFloat(maxScore);
    if (minEntryQuality !== undefined) customFilters.minEntryQuality = parseFloat(minEntryQuality);
    if (minRSI !== undefined) customFilters.minRSI = parseFloat(minRSI);
    if (maxRSI !== undefined) customFilters.maxRSI = parseFloat(maxRSI);
    if (minADX !== undefined) customFilters.minADX = parseFloat(minADX);
    if (maxADX !== undefined) customFilters.maxADX = parseFloat(maxADX);
    if (minChange24h !== undefined) customFilters.minChange24h = parseFloat(minChange24h);
    if (maxChange24h !== undefined) customFilters.maxChange24h = parseFloat(maxChange24h);
    if (hasBullishDivergence === 'true') customFilters.hasBullishDivergence = true;
    if (hasBearishDivergence === 'true') customFilters.hasBearishDivergence = true;
    if (hasDoubleBottom === 'true') customFilters.hasDoubleBottom = true;
    if (doubleBottomConfirmed === 'true') customFilters.doubleBottomConfirmed = true;
    if (hasDoubleTop === 'true') customFilters.hasDoubleTop = true;
    if (nearSupport === 'true') customFilters.nearSupport = true;
    if (nearResistance === 'true') customFilters.nearResistance = true;
    if (maxDistanceToSupport !== undefined) customFilters.maxDistanceToSupport = parseFloat(maxDistanceToSupport);
    if (maxWarnings !== undefined) customFilters.maxWarnings = parseInt(maxWarnings);
    if (noWarnings === 'true') customFilters.noWarnings = true;

    // Führe Screener aus
    const result = await runScreener({
      preset: preset || null,
      filters: customFilters,
      interval,
      sortBy,
      sortOrder,
      limit: parseInt(limit)
    });

    res.json(result);

  } catch (error) {
    console.error('Screener API error:', error);
    res.status(500).json({
      success: false,
      error: 'Screener fehlgeschlagen',
      message: error.message
    });
  }
});

/**
 * GET /api/screener/quick
 * 
 * Schneller Screener für Dashboard-Übersicht
 * Nur Score, Signal, Entry Quality - keine Pattern/Divergenz
 */
router.get('/quick', async (req, res) => {
  try {
    const { interval = '4h' } = req.query;

    const validIntervals = ['1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: `Ungültiges Interval: ${interval}`
      });
    }

    const result = await runQuickScreener(interval);
    res.json(result);

  } catch (error) {
    console.error('Quick Screener error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/screener/presets
 * 
 * Gibt alle verfügbaren Filter-Presets zurück
 */
router.get('/presets', (req, res) => {
  const presets = Object.entries(FILTER_PRESETS).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    filters: value.filters
  }));

  res.json({
    presets,
    count: presets.length
  });
});

/**
 * GET /api/screener/status
 * 
 * Gibt Cache und Rate-Limit Status zurück
 */
router.get('/status', (req, res) => {
  res.json({
    cache: getCacheStats(),
    rateLimit: getRateLimitStatus(),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/screener/clear-cache
 * 
 * Leert den Cache (für Admin/Debug)
 */
router.post('/clear-cache', (req, res) => {
  clearCache();
  res.json({
    success: true,
    message: 'Cache cleared',
    newStats: getCacheStats()
  });
});

export default router;
