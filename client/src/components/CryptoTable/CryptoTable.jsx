import { useState, useEffect } from 'react';
import { getTop50Prices, getAnalysis } from '../../services/api';
import { addToPortfolio, loadTradingStrategy, saveTradingStrategy } from '../../utils/storage';
import { STRATEGIES, matchesStrategy, sortByStrategy, matchesRecommendationFilter, matchesScoreRange } from '../../utils/strategies';

/**
 * CryptoTable Komponente
 * 
 * Zeigt eine Tabelle mit den Top 50 Coins an, inklusive:
 * - Live-Preise
 * - 24h Änderungen
 * - Buy/Sell Scores (basierend auf technischer Analyse)
 * - Trend-Stärke (ADX)
 * - Aktionen (Add to Portfolio)
 * 
 * Features:
 * - Automatisches Polling alle 1-2 Minuten
 * - Sortierbare Spalten
 * - Farbcodierung nach Score
 * - Loading States
 * 
 * Props:
 * - onAddToPortfolio: Callback wenn Coin zum Portfolio hinzugefügt wird
 * - onSymbolSelect: Callback wenn Symbol angeklickt wird (für Detail-Ansicht)
 */
export default function CryptoTable({ onAddToPortfolio, onSymbolSelect }) {
  // State für Coins und Analysen
  const [coins, setCoins] = useState([]);
  const [analyses, setAnalyses] = useState({}); // Symbol -> Analysis Mapping
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });
  
  // Filter State
  const [selectedStrategy, setSelectedStrategy] = useState(loadTradingStrategy());
  const [recommendationFilters, setRecommendationFilters] = useState({
    STRONG_BUY: true,
    BUY: true,
    HOLD: false,
    SELL: false,
    STRONG_SELL: false
  });
  const [scoreRange, setScoreRange] = useState({ min: null, max: null });
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Lade Coins und starte Polling
   */
  const fetchData = async () => {
    try {
      setError(null);
      
      // Hole Top 50 Coins
      const pricesData = await getTop50Prices();
      setCoins(pricesData);

      // Hole Analysen für alle Coins (parallel, aber mit Limit um API nicht zu überlasten)
      // Wir analysieren nur die ersten 20 Coins um Performance zu gewährleisten
      const top20 = pricesData.slice(0, 20);
      const analysisPromises = top20.map(async (coin) => {
        try {
          const analysis = await getAnalysis(coin.symbol, '1h');
          return { symbol: coin.symbol, analysis };
        } catch (err) {
          console.error(`Error analyzing ${coin.symbol}:`, err);
          return { symbol: coin.symbol, analysis: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      const analysisMap = {};
      analysisResults.forEach(({ symbol, analysis }) => {
        analysisMap[symbol] = analysis;
      });
      setAnalyses(analysisMap);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchData();
  }, []);

  // Polling alle 2 Minuten (120000ms)
  useEffect(() => {
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Sortiere Tabelle nach Spalte
   * 
   * @param {string} key - Spalten-Key zum Sortieren
   */
  const handleSort = (key) => {
    let direction = 'desc';
    
    // Wenn bereits nach dieser Spalte sortiert, wechsle Richtung
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    
    setSortConfig({ key, direction });
  };

  /**
   * Handle Strategy Change
   */
  const handleStrategyChange = (strategy) => {
    setSelectedStrategy(strategy);
    saveTradingStrategy(strategy);
    
    // Update recommendation filters based on strategy
    if (strategy === 'conservative') {
      setRecommendationFilters({
        STRONG_BUY: true,
        BUY: false,
        HOLD: false,
        SELL: false,
        STRONG_SELL: false
      });
    } else if (strategy === 'aggressive') {
      setRecommendationFilters({
        STRONG_BUY: true,
        BUY: true,
        HOLD: false,
        SELL: false,
        STRONG_SELL: false
      });
    } else if (strategy === 'momentum') {
      setRecommendationFilters({
        STRONG_BUY: true,
        BUY: true,
        HOLD: false,
        SELL: false,
        STRONG_SELL: false
      });
    }
  };

  /**
   * Filter Coins basierend auf Strategy und Filters
   */
  const filteredCoins = coins.filter(coin => {
    const analysis = analyses[coin.symbol];
    
    // Strategy Filter
    if (selectedStrategy && selectedStrategy !== 'none') {
      if (!matchesStrategy(coin, analysis, selectedStrategy)) {
        return false;
      }
    }
    
    // Recommendation Filter
    const allowedRecommendations = Object.keys(recommendationFilters)
      .filter(key => recommendationFilters[key]);
    if (!matchesRecommendationFilter(coin, analysis, allowedRecommendations)) {
      return false;
    }
    
    // Score Range Filter
    if (!matchesScoreRange(coin, analysis, scoreRange.min, scoreRange.max)) {
      return false;
    }
    
    return true;
  });

  /**
   * Sortiere Coins Array basierend auf sortConfig und Strategy
   */
  const sortedCoins = (() => {
    // Wenn Strategy aktiv ist, sortiere nach Strategy
    if (selectedStrategy && selectedStrategy !== 'none') {
      return sortByStrategy(filteredCoins, analyses, selectedStrategy);
    }
    
    // Sonst normale Sortierung
    return [...filteredCoins].sort((a, b) => {
    let aValue, bValue;

    switch (sortConfig.key) {
      case 'symbol':
        aValue = a.symbol;
        bValue = b.symbol;
        break;
      case 'price':
        aValue = a.price;
        bValue = b.price;
        break;
      case 'change24h':
        aValue = a.change24h;
        bValue = b.change24h;
        break;
      case 'score':
        // Score aus Analysis holen
        aValue = analyses[a.symbol]?.recommendations?.score || 0;
        bValue = analyses[b.symbol]?.recommendations?.score || 0;
        break;
      case 'volume24h':
        aValue = a.volume24h;
        bValue = b.volume24h;
        break;
      default:
        return 0;
    }

    // Vergleiche Werte
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
    });
  })();

  /**
   * Hole Score für einen Coin
   */
  const getScore = (symbol) => {
    return analyses[symbol]?.recommendations?.score || null;
  };

  /**
   * Hole Recommendation für einen Coin
   */
  const getRecommendation = (symbol) => {
    return analyses[symbol]?.recommendations?.recommendation || null;
  };

  /**
   * Bestimme Farbe basierend auf Score (reduzierte Farbpalette)
   */
  const getScoreColor = (score) => {
    if (score === null) return 'text-gray-500';
    if (score >= 60) return 'text-gray-200 font-semibold';
    if (score >= 50) return 'text-gray-300';
    if (score >= 40) return 'text-gray-400';
    if (score >= 30) return 'text-gray-500';
    return 'text-gray-600 font-semibold';
  };

  /**
   * Bestimme Background-Farbe für Score-Zelle (reduzierte Farbpalette)
   */
  const getScoreBgColor = (score) => {
    if (score === null) return 'bg-gray-800';
    if (score >= 60) return 'bg-gray-700/50';
    if (score >= 50) return 'bg-gray-800/50';
    if (score >= 40) return 'bg-gray-800';
    if (score >= 30) return 'bg-gray-800';
    return 'bg-gray-800';
  };

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
   * Handle Add to Portfolio
   */
  const handleAddToPortfolio = (coin) => {
    // Öffne Dialog für Menge und Preis
    const amount = prompt(`Wie viel ${coin.symbol} möchtest du zum Portfolio hinzufügen?`);
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return;
    }

    const buyPrice = coin.price; // Aktueller Preis als Einkaufspreis
    addToPortfolio(coin.symbol, parseFloat(amount), buyPrice);
    
    if (onAddToPortfolio) {
      onAddToPortfolio();
    }
  };

  if (loading && coins.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Daten...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 m-4">
        <div className="text-gray-300 font-semibold">Fehler</div>
        <div className="text-gray-400 text-sm mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Panel */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold coin-symbol">Filter & Strategien</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
          >
            {showFilters ? 'Filter ausblenden' : 'Filter anzeigen'}
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            {/* Strategy Selection */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Trading-Strategie</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(STRATEGIES).map((strategy) => (
                  <button
                    key={strategy.id}
                    onClick={() => handleStrategyChange(strategy.id)}
                    className={`p-4 rounded-lg text-left transition ${
                      selectedStrategy === strategy.id
                        ? 'bg-gray-700 border-2 border-gray-500'
                        : 'bg-gray-900 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{strategy.icon}</span>
                      <span className="font-semibold coin-symbol">{strategy.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">{strategy.description}</div>
                  </button>
                ))}
                <button
                  onClick={() => handleStrategyChange('none')}
                  className={`p-4 rounded-lg text-left transition ${
                    selectedStrategy === 'none' || !selectedStrategy
                      ? 'bg-gray-700 border-2 border-gray-500'
                      : 'bg-gray-900 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                >
                  <div className="font-semibold coin-symbol mb-1">Keine Strategie</div>
                  <div className="text-xs text-gray-400">Alle Coins anzeigen</div>
                </button>
              </div>
            </div>

            {/* Recommendation Filters */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Empfehlungs-Typen</label>
              <div className="flex flex-wrap gap-3">
                {['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'].map((rec) => (
                  <label key={rec} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recommendationFilters[rec] || false}
                      onChange={(e) => setRecommendationFilters({
                        ...recommendationFilters,
                        [rec]: e.target.checked
                      })}
                      className="w-4 h-4 rounded bg-gray-900 border-gray-600 text-gray-700 focus:ring-gray-500"
                    />
                    <span className="text-sm text-gray-300">{rec.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Score Range Filter */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Score-Bereich</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                  <input
                    type="number"
                    value={scoreRange.min || ''}
                    onChange={(e) => setScoreRange({
                      ...scoreRange,
                      min: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                  <input
                    type="number"
                    value={scoreRange.max || ''}
                    onChange={(e) => setScoreRange({
                      ...scoreRange,
                      max: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    placeholder="100"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                  />
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-400">
              {filteredCoins.length} von {coins.length} Coins angezeigt
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-700">
            <th 
              className="text-left p-3 text-gray-400 font-semibold cursor-pointer hover:text-white transition"
              onClick={() => handleSort('symbol')}
            >
              Symbol
              {sortConfig.key === 'symbol' && (
                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="text-right p-3 text-gray-400 font-semibold cursor-pointer hover:text-white transition"
              onClick={() => handleSort('price')}
            >
              Preis
              {sortConfig.key === 'price' && (
                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="text-right p-3 text-gray-400 font-semibold cursor-pointer hover:text-white transition"
              onClick={() => handleSort('change24h')}
            >
              24h Change
              {sortConfig.key === 'change24h' && (
                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th 
              className="text-right p-3 text-gray-400 font-semibold cursor-pointer hover:text-white transition"
              onClick={() => handleSort('score')}
            >
              Buy/Sell Score
              {sortConfig.key === 'score' && (
                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th className="text-center p-3 text-gray-400 font-semibold">Empfehlung</th>
            <th 
              className="text-right p-3 text-gray-400 font-semibold cursor-pointer hover:text-white transition"
              onClick={() => handleSort('volume24h')}
            >
              Volumen 24h
              {sortConfig.key === 'volume24h' && (
                <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
            <th className="text-center p-3 text-gray-400 font-semibold">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {sortedCoins.map((coin) => {
            const score = getScore(coin.symbol);
            const recommendation = getRecommendation(coin.symbol);
            const changeColor = coin.change24h >= 0 ? 'text-green-400' : 'text-red-400';

            return (
              <tr 
                key={coin.symbol} 
                className="border-b border-gray-800 hover:bg-gray-800/50 transition"
              >
                <td 
                  className="p-3 coin-symbol cursor-pointer hover:text-gray-200 transition"
                  onClick={() => onSymbolSelect && onSymbolSelect(coin.symbol)}
                >
                  {coin.symbol}
                </td>
                <td className="p-3 text-right">{formatPrice(coin.price)}</td>
                <td className={`p-3 text-right ${changeColor}`}>
                  {formatPercent(coin.change24h)}
                </td>
                <td className={`p-3 text-right ${getScoreBgColor(score)}`}>
                  {score !== null ? (
                    <span className={getScoreColor(score)}>
                      {score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">Berechne...</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {recommendation && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold coin-symbol ${
                      recommendation === 'STRONG_BUY' ? 'bg-gray-700 text-gray-200' :
                      recommendation === 'BUY' ? 'bg-gray-800 text-gray-300' :
                      recommendation === 'HOLD' ? 'bg-gray-800 text-gray-400' :
                      recommendation === 'SELL' ? 'bg-gray-800 text-gray-500' :
                      'bg-gray-800 text-gray-600'
                    }`}>
                      {recommendation.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td className="p-3 text-right text-gray-400 text-sm">
                  ${(coin.volume24h / 1000000).toFixed(2)}M
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleAddToPortfolio(coin)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
                  >
                    + Portfolio
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
        {loading && coins.length > 0 && (
          <div className="text-center p-4 text-gray-400 text-sm">
            Aktualisiere Daten...
          </div>
        )}
      </div>
    </div>
  );
}

