import { useState, useEffect, useCallback } from 'react';

/**
 * ScreenerPanel Component
 * 
 * Scannt alle Coins nach konfigurierbaren Kriterien
 * - Preset-Filter (Strong Buy, Pullback, etc.)
 * - Custom Filter
 * - Sortierung
 * - Live-Updates
 */
export default function ScreenerPanel({ onSelectCoin }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  
  // Filter State
  const [preset, setPreset] = useState('');
  const [interval, setInterval] = useState('4h');
  const [sortBy, setSortBy] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Custom Filters
  const [showCustomFilters, setShowCustomFilters] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    minScore: '',
    maxRSI: '',
    minEntryQuality: '',
    hasBullishDivergence: false,
    hasDoubleBottom: false,
    nearSupport: false,
    noWarnings: false
  });
  
  // Presets
  const presets = [
    { id: '', name: 'Alle Coins' },
    { id: 'STRONG_BUY', name: '🚀 Strong Buy' },
    { id: 'PULLBACK_ENTRY', name: '🎯 Pullback Entry' },
    { id: 'OVERSOLD', name: '📉 Überverkauft (RSI < 30)' },
    { id: 'NEAR_SUPPORT', name: '🛡️ Nahe Support' },
    { id: 'DOUBLE_BOTTOM', name: '📈 Double Bottom' },
    { id: 'BULLISH_DIVERGENCE', name: '🔄 Bullishe Divergenz' }
  ];

  /**
   * Führt Screener aus
   */
  const runScreener = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build Query String
      const params = new URLSearchParams();
      
      if (preset) params.append('preset', preset);
      params.append('interval', interval);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('limit', '50');
      
      // Custom Filters
      if (!preset || showCustomFilters) {
        if (customFilters.minScore) params.append('minScore', customFilters.minScore);
        if (customFilters.maxRSI) params.append('maxRSI', customFilters.maxRSI);
        if (customFilters.minEntryQuality) params.append('minEntryQuality', customFilters.minEntryQuality);
        if (customFilters.hasBullishDivergence) params.append('hasBullishDivergence', 'true');
        if (customFilters.hasDoubleBottom) params.append('hasDoubleBottom', 'true');
        if (customFilters.nearSupport) params.append('nearSupport', 'true');
        if (customFilters.noWarnings) params.append('noWarnings', 'true');
      }

      const response = await fetch(`http://localhost:5001/api/screener?${params}`);
      
      if (!response.ok) {
        throw new Error('Screener fehlgeschlagen');
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
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [preset, interval, sortBy, sortOrder, customFilters, showCustomFilters]);

  // Initial load
  useEffect(() => {
    runScreener();
  }, []);

  /**
   * Format Helpers
   */
  const formatPrice = (price) => {
    if (!price) return '-';
    if (price >= 1) return `$${price.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`;
    return `$${price.toFixed(6)}`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getScoreColor = (score) => {
    if (score >= 65) return 'text-green-400';
    if (score >= 55) return 'text-green-300';
    if (score >= 45) return 'text-yellow-400';
    if (score >= 35) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSignalBadge = (status) => {
    switch (status) {
      case 'STRONG_BUY_NOW':
        return { bg: 'bg-green-600', text: 'STRONG BUY' };
      case 'STRONG_BUY':
        return { bg: 'bg-green-500', text: 'Strong Buy' };
      case 'BUY':
        return { bg: 'bg-green-400', text: 'Buy' };
      case 'HOLD':
        return { bg: 'bg-yellow-500', text: 'Hold' };
      case 'SELL':
        return { bg: 'bg-red-400', text: 'Sell' };
      case 'STRONG_SELL':
        return { bg: 'bg-red-600', text: 'Strong Sell' };
      default:
        return { bg: 'bg-gray-600', text: status };
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🔍</span> Screener
          </h2>
          
          <button
            onClick={runScreener}
            disabled={loading}
            className={`px-4 py-2 rounded font-semibold transition ${
              loading 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '⏳ Scanning...' : '🔄 Scan starten'}
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Preset */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Timeframe</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="1h">1 Stunde</option>
              <option value="4h">4 Stunden</option>
              <option value="1d">1 Tag</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sortieren nach</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="score">Score</option>
              <option value="entryQuality">Entry Quality</option>
              <option value="rsi">RSI</option>
              <option value="change24h">24h Change</option>
              <option value="volume24h">Volumen</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reihenfolge</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="desc">Absteigend ↓</option>
              <option value="asc">Aufsteigend ↑</option>
            </select>
          </div>
        </div>

        {/* Custom Filters Toggle */}
        <button
          onClick={() => setShowCustomFilters(!showCustomFilters)}
          className="mt-3 text-sm text-blue-400 hover:text-blue-300"
        >
          {showCustomFilters ? '▼ Custom Filter ausblenden' : '▶ Custom Filter anzeigen'}
        </button>

        {/* Custom Filters */}
        {showCustomFilters && (
          <div className="mt-3 p-3 bg-gray-900/50 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Score</label>
              <input
                type="number"
                value={customFilters.minScore}
                onChange={(e) => setCustomFilters({...customFilters, minScore: e.target.value})}
                placeholder="z.B. 60"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max RSI</label>
              <input
                type="number"
                value={customFilters.maxRSI}
                onChange={(e) => setCustomFilters({...customFilters, maxRSI: e.target.value})}
                placeholder="z.B. 50"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Entry Quality</label>
              <input
                type="number"
                value={customFilters.minEntryQuality}
                onChange={(e) => setCustomFilters({...customFilters, minEntryQuality: e.target.value})}
                placeholder="z.B. 55"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={customFilters.hasBullishDivergence}
                  onChange={(e) => setCustomFilters({...customFilters, hasBullishDivergence: e.target.checked})}
                  className="rounded"
                />
                Divergenz
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={customFilters.hasDoubleBottom}
                  onChange={(e) => setCustomFilters({...customFilters, hasDoubleBottom: e.target.checked})}
                  className="rounded"
                />
                Dbl Bottom
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={customFilters.nearSupport}
                onChange={(e) => setCustomFilters({...customFilters, nearSupport: e.target.checked})}
                className="rounded"
              />
              Nahe Support
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={customFilters.noWarnings}
                onChange={(e) => setCustomFilters({...customFilters, noWarnings: e.target.checked})}
                className="rounded"
              />
              Keine Warnungen
            </label>
          </div>
        )}
      </div>

      {/* Meta Info */}
      {meta && (
        <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-700 text-xs text-gray-400 flex gap-4 flex-wrap">
          <span>📊 {meta.matchingCoins} von {meta.totalCoins} Coins</span>
          <span>⏱️ {meta.duration}ms</span>
          <span>📦 Cache: {meta.cacheStats?.validEntries || 0} Einträge</span>
          <span>🔄 API: {meta.rateLimitStatus?.requestsInLastMinute || 0}/min</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border-b border-red-700 text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Coin</th>
              <th className="px-4 py-3 text-right">Preis</th>
              <th className="px-4 py-3 text-right">24h</th>
              <th className="px-4 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-center">Signal</th>
              <th className="px-4 py-3 text-center">Entry Q</th>
              <th className="px-4 py-3 text-center">RSI</th>
              <th className="px-4 py-3 text-center">Pattern</th>
              <th className="px-4 py-3 text-center">⚠️</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span>Scanne {meta?.totalCoins || 50} Coins...</span>
                  </div>
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-400">
                  Keine Coins entsprechen den Filtern
                </td>
              </tr>
            ) : (
              results.map((coin, index) => {
                const signalBadge = getSignalBadge(coin.signalStatus);
                
                return (
                  <tr
                    key={coin.symbol}
                    onClick={() => onSelectCoin && onSelectCoin(coin.symbol)}
                    className="hover:bg-gray-700/50 cursor-pointer transition"
                  >
                    {/* Coin */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-5">{index + 1}</span>
                        <span className="font-semibold">{coin.symbol}</span>
                      </div>
                    </td>
                    
                    {/* Price */}
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatPrice(coin.price)}
                    </td>
                    
                    {/* 24h Change */}
                    <td className={`px-4 py-3 text-right text-sm ${
                      coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(coin.change24h)}
                    </td>
                    
                    {/* Score */}
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${getScoreColor(coin.score)}`}>
                        {coin.score}
                      </span>
                    </td>
                    
                    {/* Signal */}
                    <td className="px-4 py-3 text-center">
                      <span className={`${signalBadge.bg} px-2 py-1 rounded text-xs font-semibold`}>
                        {signalBadge.text}
                      </span>
                    </td>
                    
                    {/* Entry Quality */}
                    <td className="px-4 py-3 text-center">
                      <span className={`${
                        coin.entryQuality >= 60 ? 'text-green-400' :
                        coin.entryQuality >= 45 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {coin.entryQuality}
                      </span>
                    </td>
                    
                    {/* RSI */}
                    <td className="px-4 py-3 text-center">
                      <span className={`${
                        coin.rsi > 70 ? 'text-red-400' :
                        coin.rsi < 30 ? 'text-green-400' : 'text-gray-300'
                      }`}>
                        {coin.rsi || '-'}
                      </span>
                    </td>
                    
                    {/* Pattern Indicators */}
                    <td className="px-4 py-3 text-center text-sm">
                      <div className="flex items-center justify-center gap-1">
                        {coin.hasBullishDivergence && (
                          <span title="Bullishe Divergenz" className="text-green-400">🔄</span>
                        )}
                        {coin.hasBearishDivergence && (
                          <span title="Bearishe Divergenz" className="text-red-400">🔄</span>
                        )}
                        {coin.doubleBottomConfirmed && (
                          <span title="Double Bottom bestätigt" className="text-green-400">W</span>
                        )}
                        {coin.hasDoubleBottom && !coin.doubleBottomConfirmed && (
                          <span title="Double Bottom in Bildung" className="text-yellow-400">w</span>
                        )}
                        {coin.doubleTopConfirmed && (
                          <span title="Double Top bestätigt" className="text-red-400">M</span>
                        )}
                        {coin.srPosition === 'AT_SUPPORT' && (
                          <span title="Am Support" className="text-green-400">S</span>
                        )}
                        {coin.srPosition === 'AT_RESISTANCE' && (
                          <span title="Am Widerstand" className="text-red-400">R</span>
                        )}
                        {!coin.hasBullishDivergence && !coin.hasBearishDivergence && 
                         !coin.hasDoubleBottom && !coin.hasDoubleTop && 
                         coin.srPosition !== 'AT_SUPPORT' && coin.srPosition !== 'AT_RESISTANCE' && (
                          <span className="text-gray-600">-</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Warnings */}
                    <td className="px-4 py-3 text-center">
                      {coin.warningsCount > 0 ? (
                        <span className="text-yellow-400" title={coin.warnings?.map(w => w.message).join('\n')}>
                          {coin.warningsCount}
                        </span>
                      ) : (
                        <span className="text-gray-600">0</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex flex-wrap gap-4">
          <span>🔄 = Divergenz</span>
          <span>W = Double Bottom</span>
          <span>M = Double Top</span>
          <span>S = Am Support</span>
          <span>R = Am Widerstand</span>
        </div>
      </div>
    </div>
  );
}
