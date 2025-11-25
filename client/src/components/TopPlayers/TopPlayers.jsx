import { useState, useEffect } from 'react';
import { getTopPlayers } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';

/**
 * TopPlayers Komponente
 * 
 * Zeigt die Top-Performer und neuen Listings an:
 * - Neue Listings (letzte 7 Tage)
 * - High Performer (hohes Volumen, starke Preisänderung)
 * - Kombinierter Score basierend auf Volumen und Preisänderung
 * 
 * Features:
 * - Automatisches Polling alle 2 Minuten
 * - Ranking nach Score
 * 
 * Props:
 * - onSymbolSelect: Callback wenn Symbol angeklickt wird (für Detail-Ansicht)
 */
export default function TopPlayers({ onSymbolSelect }) {
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Lade Top Players
   */
  const fetchData = async () => {
    try {
      setError(null);
      const data = await getTopPlayers();
      setTopPlayers(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching top players:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchData();
  }, []);

  // Polling alle 2 Minuten
  usePolling(fetchData, 120000);

  /**
   * Formatiere Preis
   */
  const formatPrice = (price) => {
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  /**
   * Formatiere Prozent
   */
  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  /**
   * Formatiere Volumen
   */
  const formatVolume = (volume) => {
    if (volume >= 1000000000) {
      return `$${(volume / 1000000000).toFixed(2)}B`;
    }
    return `$${(volume / 1000000).toFixed(2)}M`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Top Players...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="text-gray-300 font-semibold">Fehler</div>
        <div className="text-gray-400 text-sm mt-1">{error}</div>
      </div>
    );
  }

  if (topPlayers.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-400">Keine Top Players gefunden</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Top Players & Neue Listings</h2>
        <p className="text-gray-400 text-sm">
          Coins mit hohem Potenzial: Neue Listings (letzte 7 Tage) und High Performer
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topPlayers.map((coin, index) => {
          const changeColor = coin.change24h >= 0 ? 'text-green-400' : 'text-red-400';
          const isNewListing = coin.change24h > 10 || coin.volume24h > 10000000;

          return (
            <div
              key={coin.symbol}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm coin-symbol">#{index + 1}</span>
                  <span 
                    className="font-semibold text-lg coin-symbol cursor-pointer hover:text-gray-200 transition"
                    onClick={() => onSymbolSelect && onSymbolSelect(coin.symbol)}
                  >
                    {coin.symbol}
                  </span>
                  {isNewListing && (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded coin-symbol">
                      NEW
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Preis</span>
                  <span className="font-semibold">{formatPrice(coin.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">24h Change</span>
                  <span className={`font-semibold ${changeColor}`}>
                    {formatPercent(coin.change24h)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Volumen 24h</span>
                  <span className="text-gray-300">{formatVolume(coin.volume24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">High 24h</span>
                  <span className="text-gray-300">{formatPrice(coin.high24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Low 24h</span>
                  <span className="text-gray-300">{formatPrice(coin.low24h)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

