import express from 'express';
import { getExchangeInfo, getTopPlayers } from '../services/binanceApi.js';

const router = express.Router();

router.get('/info', async (req, res) => {
  try {
    const info = await getExchangeInfo();
    res.json(info);
  } catch (error) {
    console.error('Error fetching exchange info:', error);
    res.status(500).json({ error: 'Failed to fetch exchange info' });
  }
});

router.get('/top-players', async (req, res) => {
  try {
    const topPlayers = await getTopPlayers();
    res.json(topPlayers);
  } catch (error) {
    console.error('Error fetching top players:', error);
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
});

export default router;

