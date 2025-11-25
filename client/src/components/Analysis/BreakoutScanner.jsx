import { useState, useEffect, useCallback } from 'react';

/**
 * BreakoutScanner Component
 * 
 * Scannt alle Coins nach Breakout-Situationen
 * Zeigt Top-Candidates mit Score, Signalen und Richtung
 */
export default function BreakoutScanner({ onSelectCoin }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [interval, setInterval] = useState('4h');
  const [minScore, setMinScore] = useState(40);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:5001/api/breakout/scan/${interval}?minScore=${minScore}&limit=20`
      );
      
      if (!response.ok) {
        throw new Error('Scan fehlgeschlagen');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        setMeta(data.meta);
      } else {
        throw new Error(data.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [interval, minScore]);

  // Initial scan
  useEffect(() => {
    scan();
  }, []);

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-green-900/50';
    if (score >= 50) return 'bg-yellow-900/50';
    return 'bg-gray-800';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>🎯</span> Breakout Scanner
          </h3>
          
          <button
            onClick={scan}
            disabled={loading}
            className={`px-4 py-2 rounded font-semibold transition ${
              loading 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '⏳ Scanne...' : '🔄 Scan'}
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value="15m">15 Min</option>
              <option value="1h">1 Stunde</option>
              <option value="4h">4 Stunden</option>
              <option value="1d">1 Tag</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">Min Score</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value={30}>30+</option>
              <option value={40}>40+</option>
              <option value={50}>50+</option>
              <option value={60}>60+</option>
              <option value={70}>70+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meta */}
      {meta && (
        <div className="px-4 py-2 bg-gray-900/50 text-xs text-gray-400 flex gap-4">
          <span>📊 {meta.potentialBreakouts} Breakout-Kandidaten gefunden</span>
          <span>⏱️ {meta.duration}ms</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Results */}
      <div className="divide-y divide-gray-700">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span>Scanne {meta?.scannedCoins || 50} Coins...</span>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Keine Breakout-Kandidaten gefunden
          </div>
        ) : (
          results.map((coin, idx) => (
            <div
              key={coin.symbol}
              onClick={() => onSelectCoin && onSelectCoin(coin.symbol)}
              className={`p-4 cursor-pointer hover:bg-gray-700/50 transition ${getScoreBg(coin.breakoutScore)}`}
            >
              <div className="flex items-center justify-between">
                {/* Left: Coin Info */}
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 text-sm w-6">{idx + 1}</span>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{coin.symbol}</span>
                      
                      {/* Active Breakout Badge */}
                      {coin.hasActiveBreakout && (
                        <span className="bg-green-600 animate-pulse px-2 py-0.5 rounded text-xs font-bold">
                          🚀 AKTIV
                        </span>
                      )}
                      
                      {/* Direction */}
                      <span className={`text-lg ${
                        coin.likelyDirection === 'UP' ? 'text-green-400' : 
                        coin.likelyDirection === 'DOWN' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {coin.likelyDirection === 'UP' ? '↑' : 
                         coin.likelyDirection === 'DOWN' ? '↓' : '↔'}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-1">
                      ${coin.price?.toFixed(coin.price > 1 ? 2 : 6)} 
                      <span className={coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {' '}({coin.change24h >= 0 ? '+' : ''}{coin.change24h?.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Score & Signals */}
                <div className="flex items-center gap-4">
                  {/* Signal Icons */}
                  <div className="flex gap-1">
                    {coin.hasSqueeze && (
                      <span title="Volatilitäts-Squeeze" className="text-purple-400">🔥</span>
                    )}
                    {coin.hasAccumulation && (
                      <span title="Accumulation" className="text-blue-400">📊</span>
                    )}
                    {coin.signals?.includes('CONSOLIDATION') && (
                      <span title="Konsolidierung" className="text-yellow-400">📦</span>
                    )}
                  </div>
                  
                  {/* Score */}
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(coin.breakoutScore)}`}>
                      {coin.breakoutScore}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                  
                  {/* Probability */}
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    coin.probability === 'Hoch' ? 'bg-green-600' :
                    coin.probability === 'Mittel' ? 'bg-yellow-600' : 'bg-gray-600'
                  }`}>
                    {coin.probability}
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <div className="text-xs text-gray-400 mt-2 ml-10">
                {coin.summary}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex gap-4">
          <span>🔥 = Squeeze</span>
          <span>📊 = Accumulation</span>
          <span>📦 = Konsolidierung</span>
          <span>🚀 = Aktiver Breakout</span>
        </div>
      </div>
    </div>
  );
}
