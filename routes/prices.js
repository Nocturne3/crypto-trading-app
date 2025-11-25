import express from 'express';
import { getTop50Prices, getCoinPrice } from '../services/binanceApi.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const prices = await getTop50Prices();
    res.json(prices);
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

/**
 * GET /api/prices/:symbol
 * 
 * Hole aktuellen Preis für einen spezifischen Coin
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const priceData = await getCoinPrice(symbol);
    res.json(priceData);
  } catch (error) {
    console.error(`Error fetching price for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      error: `Failed to fetch price for ${req.params.symbol}`,
      message: error.message 
    });
  }
});

export default router;

