/**
 * Binance API Service - Enhanced Version v2.4
 * 
 * Features:
 * - Caching mit konfigurierbarer TTL
 * - Rate-Limiting (max requests pro Minute)
 * - Request Queue für Screener
 * - Batch-Processing für mehrere Coins
 */

import axios from 'axios';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// ============================================
// CACHING SYSTEM
// ============================================

const cache = new Map();

/**
 * Cache-Konfiguration (TTL in Millisekunden)
 */
const CACHE_TTL = {
  prices: 30 * 1000,        // 30 Sekunden für Preise
  klines_1m: 30 * 1000,     // 30 Sekunden für 1m Candles
  klines_5m: 60 * 1000,     // 1 Minute für 5m Candles
  klines_15m: 2 * 60 * 1000, // 2 Minuten für 15m Candles
  klines_1h: 5 * 60 * 1000,  // 5 Minuten für 1h Candles
  klines_4h: 10 * 60 * 1000, // 10 Minuten für 4h Candles
  klines_1d: 30 * 60 * 1000, // 30 Minuten für 1d Candles
  exchangeInfo: 60 * 60 * 1000, // 1 Stunde für Exchange Info
  default: 60 * 1000        // 1 Minute default
};

/**
 * Generiert einen Cache-Key
 */
function getCacheKey(type, ...args) {
  return `${type}:${args.join(':')}`;
}

/**
 * Holt Wert aus Cache wenn noch gültig
 */
function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() > cached.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * Speichert Wert im Cache
 */
function setCache(key, data, ttlMs) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    cachedAt: Date.now()
  });
}

/**
 * Gibt Cache-Statistiken zurück
 */
export function getCacheStats() {
  let validEntries = 0;
  let expiredEntries = 0;
  const now = Date.now();
  
  cache.forEach((value, key) => {
    if (now > value.expiresAt) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  });
  
  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries,
    memorySizeEstimate: `~${Math.round(JSON.stringify([...cache]).length / 1024)} KB`
  };
}

/**
 * Leert den Cache
 */
export function clearCache() {
  cache.clear();
  console.log('🗑️ Cache cleared');
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimiter = {
  requests: [],
  maxRequests: 1000,  // Max Requests pro Minute (unter Binance Limit)
  windowMs: 60 * 1000 // 1 Minute Window
};

/**
 * Prüft ob Request erlaubt ist
 */
function checkRateLimit() {
  const now = Date.now();
  
  // Entferne alte Requests
  rateLimiter.requests = rateLimiter.requests.filter(
    time => now - time < rateLimiter.windowMs
  );
  
  if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
    const oldestRequest = Math.min(...rateLimiter.requests);
    const waitTime = rateLimiter.windowMs - (now - oldestRequest);
    return { allowed: false, waitTime };
  }
  
  return { allowed: true, waitTime: 0 };
}

/**
 * Registriert einen Request
 */
function registerRequest() {
  rateLimiter.requests.push(Date.now());
}

/**
 * Gibt Rate-Limit Status zurück
 */
export function getRateLimitStatus() {
  const now = Date.now();
  const recentRequests = rateLimiter.requests.filter(
    time => now - time < rateLimiter.windowMs
  );
  
  return {
    requestsInLastMinute: recentRequests.length,
    maxRequestsPerMinute: rateLimiter.maxRequests,
    remainingRequests: rateLimiter.maxRequests - recentRequests.length,
    utilizationPercent: Math.round((recentRequests.length / rateLimiter.maxRequests) * 100)
  };
}

// ============================================
// REQUEST QUEUE (für Screener)
// ============================================

const requestQueue = {
  queue: [],
  processing: false,
  delayBetweenRequests: 100 // 100ms zwischen Requests
};

/**
 * Fügt Request zur Queue hinzu und wartet auf Ergebnis
 */
async function queueRequest(requestFn) {
  return new Promise((resolve, reject) => {
    requestQueue.queue.push({ requestFn, resolve, reject });
    processQueue();
  });
}

/**
 * Verarbeitet die Queue
 */
async function processQueue() {
  if (requestQueue.processing || requestQueue.queue.length === 0) {
    return;
  }
  
  requestQueue.processing = true;
  
  while (requestQueue.queue.length > 0) {
    const { requestFn, resolve, reject } = requestQueue.queue.shift();
    
    // Rate-Limit prüfen
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      console.log(`⏳ Rate limit reached, waiting ${rateCheck.waitTime}ms`);
      await sleep(rateCheck.waitTime);
    }
    
    try {
      registerRequest();
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    }
    
    // Kleine Pause zwischen Requests
    await sleep(requestQueue.delayBetweenRequests);
  }
  
  requestQueue.processing = false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// API FUNCTIONS (mit Caching)
// ============================================

/**
 * Get top 50 coins by volume
 * Cached für 30 Sekunden
 */
export async function getTop50Prices() {
  const cacheKey = getCacheKey('prices', 'top50');
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit erreicht. Warte ${Math.ceil(rateCheck.waitTime / 1000)} Sekunden.`);
  }
  
  registerRequest();
  
  try {
    const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`);
    const allTickers = response.data;
    
    const usdtPairs = allTickers
      .filter(ticker => ticker.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);
    
    const result = usdtPairs.map(ticker => ({
      symbol: ticker.symbol.replace('USDT', ''),
      fullSymbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice)
    }));
    
    setCache(cacheKey, result, CACHE_TTL.prices);
    return result;
    
  } catch (error) {
    console.error('Binance API error:', error.message);
    throw error;
  }
}

/**
 * Get historical kline data
 * Cached basierend auf Interval
 */
export async function getHistoricalData(symbol, interval = '1h', limit = 168) {
  const cacheKey = getCacheKey('klines', symbol, interval, limit);
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit erreicht. Warte ${Math.ceil(rateCheck.waitTime / 1000)} Sekunden.`);
  }
  
  registerRequest();
  
  try {
    const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const response = await axios.get(`${BINANCE_API_BASE}/klines`, {
      params: {
        symbol: fullSymbol,
        interval: interval,
        limit: limit
      }
    });
    
    const result = response.data.map(kline => ({
      timestamp: kline[0],
      time: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));
    
    // TTL basierend auf Interval
    const ttlKey = `klines_${interval}`;
    const ttl = CACHE_TTL[ttlKey] || CACHE_TTL.default;
    
    setCache(cacheKey, result, ttl);
    return result;
    
  } catch (error) {
    console.error(`Binance API error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get historical data with queue (für Screener - verhindert Rate Limit)
 */
export async function getHistoricalDataQueued(symbol, interval = '1h', limit = 168) {
  const cacheKey = getCacheKey('klines', symbol, interval, limit);
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  // Über Queue laufen lassen
  return queueRequest(async () => {
    return getHistoricalData(symbol, interval, limit);
  });
}

/**
 * Get price for a specific coin
 */
export async function getCoinPrice(symbol) {
  const cacheKey = getCacheKey('price', symbol);
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit erreicht.`);
  }
  
  registerRequest();
  
  try {
    const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const response = await axios.get(`${BINANCE_API_BASE}/ticker/24hr`, {
      params: { symbol: fullSymbol }
    });
    
    const ticker = response.data;
    const result = {
      symbol: ticker.symbol.replace('USDT', ''),
      fullSymbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice)
    };
    
    setCache(cacheKey, result, CACHE_TTL.prices);
    return result;
    
  } catch (error) {
    console.error(`Binance API error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get exchange info
 * Cached für 1 Stunde
 */
export async function getExchangeInfo() {
  const cacheKey = getCacheKey('exchangeInfo');
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  registerRequest();
  
  try {
    const response = await axios.get(`${BINANCE_API_BASE}/exchangeInfo`);
    setCache(cacheKey, response.data, CACHE_TTL.exchangeInfo);
    return response.data;
  } catch (error) {
    console.error('Binance API error:', error.message);
    throw error;
  }
}

/**
 * Get new listings from last 7 days
 * (Hinweis: Binance gibt kein direktes Listing-Datum, daher approximiert)
 */
export async function getNewListings() {
  const cacheKey = getCacheKey('newListings');
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  try {
    const exchangeInfo = await getExchangeInfo();
    
    const newListings = exchangeInfo.symbols
      .filter(symbol => {
        // Filter USDT pairs that are actively trading
        return symbol.symbol.endsWith('USDT') && symbol.status === 'TRADING';
      })
      .map(symbol => symbol.symbol);
    
    setCache(cacheKey, newListings, CACHE_TTL.exchangeInfo);
    return newListings;
  } catch (error) {
    console.error('Error getting new listings:', error);
    throw error;
  }
}

/**
 * Get top players (new listings + high performers)
 * Kombiniert neue Listings mit Top-Performern
 */
export async function getTopPlayers() {
  const cacheKey = getCacheKey('topPlayers');
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
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
    
    setCache(cacheKey, topPlayers, CACHE_TTL.prices);
    return topPlayers;
  } catch (error) {
    console.error('Error getting top players:', error);
    throw error;
  }
}

// ============================================
// BATCH FUNCTIONS (für Screener)
// ============================================

/**
 * Holt Kline-Daten für mehrere Symbole
 * Nutzt Queue um Rate-Limits zu vermeiden
 * 
 * @param {Array} symbols - Array von Symbols
 * @param {string} interval - Timeframe
 * @param {number} limit - Anzahl Candles
 * @returns {Object} { symbol: candles, ... }
 */
export async function getBatchHistoricalData(symbols, interval = '4h', limit = 200) {
  const results = {};
  const errors = {};
  
  console.log(`📊 Fetching data for ${symbols.length} symbols (interval: ${interval})...`);
  
  // Zuerst aus Cache holen was möglich ist
  const uncachedSymbols = [];
  
  for (const symbol of symbols) {
    const cacheKey = getCacheKey('klines', symbol, interval, limit);
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      results[symbol] = cached;
    } else {
      uncachedSymbols.push(symbol);
    }
  }
  
  console.log(`   ✓ ${symbols.length - uncachedSymbols.length} from cache`);
  console.log(`   → ${uncachedSymbols.length} to fetch`);
  
  // Uncached Symbole über Queue holen
  const fetchPromises = uncachedSymbols.map(symbol => 
    getHistoricalDataQueued(symbol, interval, limit)
      .then(data => {
        results[symbol] = data;
      })
      .catch(err => {
        errors[symbol] = err.message;
        console.error(`   ✗ Error fetching ${symbol}: ${err.message}`);
      })
  );
  
  await Promise.all(fetchPromises);
  
  console.log(`📊 Batch complete: ${Object.keys(results).length} success, ${Object.keys(errors).length} errors`);
  
  return { results, errors };
}

/**
 * Screener-optimierte Funktion
 * Holt alle notwendigen Daten für einen Screener-Durchlauf
 */
export async function getScreenerData(symbols, interval = '4h') {
  const startTime = Date.now();
  
  // Preise (ein Request für alle)
  const prices = await getTop50Prices();
  const priceMap = {};
  prices.forEach(p => { priceMap[p.symbol] = p; });
  
  // Candles (mit Queue)
  const { results: candleData, errors } = await getBatchHistoricalData(symbols, interval, 200);
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ Screener data loaded in ${duration}ms`);
  
  return {
    prices: priceMap,
    candles: candleData,
    errors,
    meta: {
      duration,
      symbolsRequested: symbols.length,
      symbolsLoaded: Object.keys(candleData).length,
      cacheStats: getCacheStats(),
      rateLimitStatus: getRateLimitStatus()
    }
  };
}

export default {
  getTop50Prices,
  getHistoricalData,
  getHistoricalDataQueued,
  getCoinPrice,
  getExchangeInfo,
  getNewListings,
  getTopPlayers,
  getBatchHistoricalData,
  getScreenerData,
  getCacheStats,
  clearCache,
  getRateLimitStatus
};
