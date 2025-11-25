/**
 * API Service für Backend-Kommunikation
 * 
 * Dieser Service stellt alle Funktionen bereit, um mit dem
 * Express.js Backend zu kommunizieren.
 * 
 * Alle Funktionen verwenden fetch() für HTTP-Requests und
 * geben JSON-Daten zurück.
 */

const API_BASE_URL = 'http://localhost:5001/api';

/**
 * Generische fetch-Funktion mit Error-Handling
 * 
 * @param {string} endpoint - API Endpoint (z.B. '/prices')
 * @param {Object} options - Fetch Options (method, body, etc.)
 * @returns {Promise} JSON Response
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Hole Top 50 Coins mit Live-Preisen
 * 
 * @returns {Promise<Array>} Array von Coin-Objekten
 * {
 *   symbol: string,
 *   fullSymbol: string,
 *   price: number,
 *   change24h: number,
 *   volume24h: number,
 *   high24h: number,
 *   low24h: number
 * }
 */
export async function getTop50Prices() {
  return fetchAPI('/prices');
}

/**
 * Hole aktuellen Preis für einen spezifischen Coin
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 * @returns {Promise<Object>} Coin-Objekt mit Preis-Daten
 */
export async function getCoinPrice(symbol) {
  return fetchAPI(`/prices/${symbol}`);
}

/**
 * Hole historische Kline-Daten für ein Symbol
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 * @param {string} interval - Zeitintervall ('1h', '4h', '1d')
 * @returns {Promise<Array>} Array von Candle-Objekten
 */
export async function getHistoricalData(symbol, interval = '1h') {
  return fetchAPI(`/historical/${symbol}/${interval}`);
}

/**
 * Hole vollständige technische Analyse für ein Symbol
 * 
 * @param {string} symbol - Crypto Symbol (z.B. 'BTC')
 * @param {string} interval - Zeitintervall ('1h', '4h', '1d')
 * @returns {Promise<Object>} Analyse-Objekt mit Recommendations
 */
export async function getAnalysis(symbol, interval = '1h') {
  return fetchAPI(`/analysis/${symbol}/${interval}`);
}

/**
 * Hole Top Players (neue Listings + High Performer)
 * 
 * @returns {Promise<Array>} Array von Top Player Coins
 */
export async function getTopPlayers() {
  return fetchAPI('/exchange/top-players');
}

/**
 * Hole Exchange Info
 * 
 * @returns {Promise<Object>} Exchange Info Objekt
 */
export async function getExchangeInfo() {
  return fetchAPI('/exchange/info');
}

/**
 * Health Check - Prüft ob Backend erreichbar ist
 * 
 * @returns {Promise<Object>} { status: 'ok', message: string }
 */
export async function healthCheck() {
  return fetchAPI('/health');
}

