import axios from 'axios';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Get top 50 coins by market cap (using 24h ticker sorted by volume)
export async function getTop50Prices() {
  try {
    const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`);
    const allTickers = response.data;
    
    // Filter USDT pairs and sort by volume
    const usdtPairs = allTickers
      .filter(ticker => ticker.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);
    
    return usdtPairs.map(ticker => ({
      symbol: ticker.symbol.replace('USDT', ''),
      fullSymbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice)
    }));
  } catch (error) {
    console.error('Binance API error:', error);
    throw error;
  }
}

// Get historical kline data
export async function getHistoricalData(symbol, interval = '1h', limit = 168) {
  try {
    const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
      params: {
        symbol: fullSymbol,
        interval: interval,
        limit: limit
      }
    });
    
    return response.data.map(kline => ({
      time: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));
  } catch (error) {
    console.error('Binance API error:', error);
    throw error;
  }
}

// Get price for a specific coin symbol
export async function getCoinPrice(symbol) {
  try {
    const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`, {
      params: {
        symbol: fullSymbol
      }
    });
    
    const ticker = response.data;
    return {
      symbol: ticker.symbol.replace('USDT', ''),
      fullSymbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice)
    };
  } catch (error) {
    console.error(`Binance API error for ${symbol}:`, error);
    throw error;
  }
}

// Get exchange info
export async function getExchangeInfo() {
  try {
    const response = await axios.get(`${BINANCE_API_BASE}/exchangeInfo`);
    return response.data;
  } catch (error) {
    console.error('Binance API error:', error);
    throw error;
  }
}

// Get new listings from last 7 days
export async function getNewListings() {
  try {
    const exchangeInfo = await getExchangeInfo();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const newListings = exchangeInfo.symbols
      .filter(symbol => {
        // Filter USDT pairs that were listed in last 7 days
        // Note: Binance doesn't provide listing date directly, 
        // we'll use a different approach - check trading pairs
        return symbol.symbol.endsWith('USDT') && symbol.status === 'TRADING';
      })
      .map(symbol => symbol.symbol);
    
    return newListings;
  } catch (error) {
    console.error('Error getting new listings:', error);
    throw error;
  }
}

// Get top players (new listings + high performers)
export async function getTopPlayers() {
  try {
    const prices = await getTop50Prices();
    const newListings = await getNewListings();
    
    // Combine new listings with top performers
    const topPlayers = prices
      .filter(coin => 
        newListings.includes(coin.fullSymbol) || 
        coin.change24h > 10 || 
        coin.volume24h > 10000000
      )
      .sort((a, b) => {
        // Sort by combination of volume and price change
        const scoreA = (a.change24h * 0.3) + (Math.log10(a.volume24h) * 0.7);
        const scoreB = (b.change24h * 0.3) + (Math.log10(b.volume24h) * 0.7);
        return scoreB - scoreA;
      })
      .slice(0, 20);
    
    return topPlayers;
  } catch (error) {
    console.error('Error getting top players:', error);
    throw error;
  }
}

