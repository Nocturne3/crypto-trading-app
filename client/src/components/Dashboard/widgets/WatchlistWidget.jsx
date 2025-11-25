import { useState, useEffect } from 'react';
import { getTop50Prices, getAnalysis } from '../../../services/api';
import { loadWatchlist } from '../../../utils/storage';
import { usePolling } from '../../../hooks/usePolling';

/**
 * Watchlist Widget
 * 
 * Zeigt die Coins aus der Watchlist mit aktuellen Preisen und Empfehlungen
 * 
 * Props:
 * - data: Dashboard data object
 * - onSymbolSelect: Callback für Symbol-Auswahl
 * - onRemove: Callback zum Entfernen des Widgets (optional)
 */
export default function WatchlistWidget({ data, onSymbolSelect, onRemove }) {
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistData, setWatchlistData] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Lade Watchlist-Daten
   */
  const fetchWatchlistData = async () => {
    try {
      const watchlistSymbols = loadWatchlist();
      setWatchlist(watchlistSymbols);

      if (watchlistSymbols.length === 0) {
        setWatchlistData([]);
        setLoading(false);
        return;
      }

      // Hole aktuelle Preise
      const prices = await getTop50Prices();
      const priceMap = {};
      prices.forEach(coin => {
        priceMap[coin.symbol] = coin;
      });

      // Hole Analysen für Watchlist-Coins
      const analysisPromises = watchlistSymbols.map(async (symbol) => {
        try {
          const analysis = await getAnalysis(symbol, '1h');
          return { symbol, analysis, priceData: priceMap[symbol] };
        } catch (err) {
          console.error(`Error analyzing ${symbol}:`, err);
          return { symbol, analysis: null, priceData: priceMap[symbol] };
        }
      });

      const results = await Promise.all(analysisPromises);
      setWatchlistData(results);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching watchlist data:', error);
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchWatchlistData();
  }, []);

  // Polling alle 2 Minuten
  usePolling(fetchWatchlistData, 120000);

  /**
   * Formatiere Preis
   */
  const formatPrice = (price) => {
    if (!price) return '-';
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  /**
   * Formatiere Prozent
   */
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  /**
   * Get Recommendation Text
   */
  const getRecommendationText = (rec) => {
    if (!rec) return '-';
    return rec.replace('_', ' ');
  };

  /**
   * Get Recommendation Color
   */
  const getRecommendationColor = (rec) => {
    switch (rec) {
      case 'STRONG_BUY':
        return 'bg-gray-700 text-gray-200';
      case 'BUY':
        return 'bg-gray-800 text-gray-300';
      case 'HOLD':
        return 'bg-gray-800 text-gray-400';
      case 'SELL':
        return 'bg-gray-800 text-gray-500';
      case 'STRONG_SELL':
        return 'bg-gray-800 text-gray-600';
      default:
        return 'bg-gray-800 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold coin-symbol">Watchlist</h3>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-gray-500 hover:text-gray-300 transition"
              title="Widget entfernen"
            >
              ×
            </button>
          )}
        </div>
        <div className="text-gray-400 text-sm">Lade Daten...</div>
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold coin-symbol">Watchlist</h3>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-gray-500 hover:text-gray-300 transition"
              title="Widget entfernen"
            >
              ×
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">Watchlist ist leer</div>
          <div className="text-gray-500 text-sm">
            Füge Coins in den Einstellungen hinzu
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold coin-symbol">Watchlist ({watchlist.length})</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 transition"
            title="Widget entfernen"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-3">
        {watchlistData.map(({ symbol, analysis, priceData }) => {
          const recommendation = analysis?.recommendations?.recommendation;
          const score = analysis?.recommendations?.score;
          const price = priceData?.price;
          const change24h = priceData?.change24h;

          return (
            <div
              key={symbol}
              className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer"
              onClick={() => onSymbolSelect && onSymbolSelect(symbol)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="coin-symbol font-semibold text-lg">{symbol}</span>
                {price && (
                  <span className="text-gray-300 font-semibold">
                    {formatPrice(price)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {recommendation && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRecommendationColor(recommendation)}`}>
                      {getRecommendationText(recommendation)}
                    </span>
                  )}
                  {score !== null && score !== undefined && (
                    <span className="text-xs text-gray-500 coin-symbol">
                      Score: {score.toFixed(1)}
                    </span>
                  )}
                </div>
                {change24h !== null && change24h !== undefined && (
                  <span className={`text-sm font-semibold ${
                    change24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercent(change24h)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

