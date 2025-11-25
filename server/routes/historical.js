import express from 'express';
import { getHistoricalData } from '../services/binanceApi.js';

const router = express.Router();

router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const data = await getHistoricalData(symbol, interval);
    res.json(data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

export default router;

