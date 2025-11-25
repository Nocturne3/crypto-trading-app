import express from 'express';
import cors from 'cors';
import pricesRoutes from './routes/prices.js';
import historicalRoutes from './routes/historical.js';
import exchangeRoutes from './routes/exchange.js';
import analysisRoutes from './routes/analysis.js';
import backtestRoutes from './routes/backtest.js';           // NEU
import multiTimeframeRoutes from './routes/multiTimeframe.js'; // NEU

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/prices', pricesRoutes);
app.use('/api/historical', historicalRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/backtest', backtestRoutes);           // NEU
app.use('/api/multi-timeframe', multiTimeframeRoutes); // NEU

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', version: '2.0.0' });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Trading App API',
    version: '2.0.0',
    endpoints: {
      prices: '/api/prices',
      historical: '/api/historical/:symbol/:interval',
      analysis: '/api/analysis/:symbol/:interval',
      exchange: '/api/exchange',
      backtest: '/api/backtest/:symbol/:interval',
      backtestCompare: '/api/backtest/compare/:symbol/:interval',
      multiTimeframe: '/api/multi-timeframe/:symbol'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
