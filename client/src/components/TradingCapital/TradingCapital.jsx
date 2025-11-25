import { useState, useEffect } from 'react';
import { getTop50Prices, getAnalysis } from '../../services/api';
import { getTradingCapital, setTradingCapital, loadTradingStrategy, saveTradingStrategy } from '../../utils/storage';
import { usePolling } from '../../hooks/usePolling';
import { STRATEGIES, matchesStrategy, sortByStrategy } from '../../utils/strategies';

/**
 * TradingCapital Komponente
 * 
 * Verwaltet das verfügbare Trading-Vermögen und gibt
 * automatische Kaufempfehlungen basierend auf:
 * - Verfügbarem Kapital
 * - Top Crypto Scores (Buy/Sell Empfehlungen)
 * - Aktuellen Kursen
 * - Potentiellem Profit
 * 
 * Features:
 * - Vermögen hinterlegen und verwalten
 * - Automatische Allokations-Empfehlungen
 * - Top 10 Kaufempfehlungen
 * - Potentieller Profit-Berechnung
 */
export default function TradingCapital({ onSymbolSelect }) {
  const [capital, setCapital] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCapital, setEditingCapital] = useState(false);
  const [newCapital, setNewCapital] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState(loadTradingStrategy());

  /**
   * Lade Vermögen und berechne Empfehlungen
   */
  const fetchData = async (strategyOverride = null) => {
    try {
      // Lade gespeichertes Vermögen
      const savedCapital = getTradingCapital();
      setCapital(savedCapital);

      if (savedCapital <= 0) {
        setLoading(false);
        return;
      }

      // Verwende übergebene Strategy oder aktuelle State
      const strategyToUse = strategyOverride !== null ? strategyOverride : selectedStrategy;

      // Hole Top 50 Coins mit Preisen
      const prices = await getTop50Prices();
      
      // Hole Analysen für Top 20 Coins (die mit höchstem Volumen)
      const top20 = prices.slice(0, 20);
      const analysisPromises = top20.map(async (coin) => {
        try {
          const analysis = await getAnalysis(coin.symbol, '1h');
          return { coin, analysis };
        } catch (err) {
          console.error(`Error analyzing ${coin.symbol}:`, err);
          return { coin, analysis: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      
      // Filtere Coins basierend auf Strategy
      const filteredResults = analysisResults.filter(({ coin, analysis }) => {
        if (!analysis || !analysis.recommendations) return false;
        
        // Apply strategy filter
        if (strategyToUse && strategyToUse !== 'none') {
          return matchesStrategy(coin, analysis, strategyToUse);
        }
        
        // Default: Buy recommendations with score >= 50
        const score = analysis.recommendations.score;
        const recommendation = analysis.recommendations.recommendation;
        return score >= 50 && (recommendation === 'BUY' || recommendation === 'STRONG_BUY');
      });
      
      // Sortiere nach Strategy
      let sortedResults = filteredResults;
      if (strategyToUse && strategyToUse !== 'none') {
        const coinsArray = filteredResults.map(({ coin }) => coin);
        const analysesMap = Object.fromEntries(filteredResults.map(({ coin, analysis }) => [coin.symbol, analysis]));
        const sortedCoins = sortByStrategy(coinsArray, analysesMap, strategyToUse);
        sortedResults = sortedCoins.map(coin => 
          filteredResults.find(({ coin: c }) => c.symbol === coin.symbol)
        ).filter(Boolean);
      }
      
      // Filtere nur Coins mit Buy-Empfehlungen
      const buyRecommendations = sortedResults
        .filter(({ analysis }) => {
          if (!analysis || !analysis.recommendations) return false;
          const recommendation = analysis.recommendations.recommendation;
          return recommendation === 'BUY' || recommendation === 'STRONG_BUY';
        })
        .map(({ coin, analysis }) => {
          const rec = analysis.recommendations;
          const currentPrice = coin.price;
          
          // Berechne empfohlene Allokation basierend auf Score
          // Höherer Score = mehr Allokation
          // Normalisiere Scores auf 0-1 Skala (50-100 -> 0-1)
          const normalizedScore = (rec.score - 50) / 50; // 0-1
          
          // Gewichtung: Score bestimmt Allokation
          // STRONG_BUY bekommt mehr Gewicht
          const weight = rec.recommendation === 'STRONG_BUY' 
            ? normalizedScore * 1.5 
            : normalizedScore;
          
          return {
            symbol: coin.symbol,
            currentPrice,
            score: rec.score,
            recommendation: rec.recommendation,
            weight,
            change24h: coin.change24h,
            volume24h: coin.volume24h
          };
        })
        .sort((a, b) => b.score - a.score) // Sortiere nach Score
        .slice(0, 10); // Top 10

      // Berechne Allokationen
      const totalWeight = buyRecommendations.reduce((sum, rec) => sum + rec.weight, 0);
      
      const recommendationsWithAllocation = buyRecommendations.map(rec => {
        // Allokation = (Gewicht / Gesamtgewicht) * Kapital
        const allocation = totalWeight > 0 
          ? (rec.weight / totalWeight) * savedCapital 
          : savedCapital / buyRecommendations.length;
        
        const amount = allocation / rec.currentPrice;
        
        // Schätze potentiellen Profit basierend auf 24h Change
        // (Konservative Schätzung: 50% des 24h Changes)
        const estimatedProfitPercent = rec.change24h * 0.5;
        const estimatedProfit = allocation * (estimatedProfitPercent / 100);

        return {
          ...rec,
          allocation,
          amount,
          estimatedProfit,
          estimatedProfitPercent
        };
      });

      setRecommendations(recommendationsWithAllocation);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trading capital data:', error);
      setLoading(false);
    }
  };

  // Load strategy on mount and initial data fetch
  useEffect(() => {
    const savedStrategy = loadTradingStrategy();
    setSelectedStrategy(savedStrategy);
    fetchData();
  }, []);

  // Polling alle 2 Minuten
  usePolling(fetchData, 120000);

  /**
   * Speichere neues Vermögen
   */
  const handleSaveCapital = () => {
    const value = parseFloat(newCapital);
    if (!isNaN(value) && value >= 0) {
      setTradingCapital(value);
      setCapital(value);
      setEditingCapital(false);
      setNewCapital('');
      fetchData(); // Aktualisiere Empfehlungen
    }
  };

  /**
   * Handle Strategy Change
   */
  const handleStrategyChange = (strategy) => {
    setSelectedStrategy(strategy);
    saveTradingStrategy(strategy);
    fetchData(strategy); // Aktualisiere Empfehlungen mit neuer Strategy
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

  const totalAllocation = recommendations.reduce((sum, rec) => sum + rec.allocation, 0);
  const totalEstimatedProfit = recommendations.reduce((sum, rec) => sum + rec.estimatedProfit, 0);
  const remainingCapital = capital - totalAllocation;

  return (
    <div>
      {/* Strategy Selection */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 coin-symbol">Trading-Strategie</h3>
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
        </div>
      </div>

      {/* Trading Capital Management */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold coin-symbol">Trading Vermögen</h2>
          {!editingCapital ? (
            <button
              onClick={() => setEditingCapital(true)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
            >
              {capital > 0 ? 'Bearbeiten' : 'Vermögen hinterlegen'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={newCapital}
                onChange={(e) => setNewCapital(e.target.value)}
                placeholder="Betrag in USD"
                className="px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
                step="0.01"
                min="0"
              />
              <button
                onClick={handleSaveCapital}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
              >
                Speichern
              </button>
              <button
                onClick={() => {
                  setEditingCapital(false);
                  setNewCapital('');
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-sm transition"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>

        {capital > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">Verfügbares Kapital</div>
              <div className="text-2xl font-semibold coin-symbol">{formatPrice(capital)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Empfohlene Allokation</div>
              <div className="text-2xl font-semibold coin-symbol">{formatPrice(totalAllocation)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Verbleibend</div>
              <div className={`text-2xl font-semibold coin-symbol ${
                remainingCapital >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPrice(remainingCapital)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Geschätzter Profit</div>
              <div className={`text-2xl font-semibold coin-symbol ${
                totalEstimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPrice(totalEstimatedProfit)}
              </div>
            </div>
          </div>
        )}

        {capital === 0 && !editingCapital && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              Noch kein Trading-Vermögen hinterlegt
            </div>
            <div className="text-gray-500 text-sm">
              Lege ein Vermögen fest, um automatische Kaufempfehlungen zu erhalten
            </div>
          </div>
        )}
      </div>

      {/* Kaufempfehlungen */}
      {capital > 0 && (
        <div>
          <div className="mb-4">
            <h3 className="text-xl font-semibold coin-symbol mb-2">Top Kaufempfehlungen</h3>
            <p className="text-gray-400 text-sm">
              Basierend auf {selectedStrategy && selectedStrategy !== 'none' 
                ? Object.values(STRATEGIES).find(s => s.id === selectedStrategy)?.name.toLowerCase() || 'technischer'
                : 'technischer'} Analyse und verfügbarem Kapital
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">
              Berechne Empfehlungen...
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Keine Buy-Empfehlungen verfügbar. Warte auf bessere Marktbedingungen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-gray-400 font-semibold">#</th>
                    <th className="text-left p-3 text-gray-400 font-semibold">Symbol</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">Aktueller Preis</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">Score</th>
                    <th className="text-center p-3 text-gray-400 font-semibold">Empfehlung</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">Empfohlene Allokation</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">Menge</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">Geschätzter Profit</th>
                    <th className="text-right p-3 text-gray-400 font-semibold">24h Change</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec, index) => (
                    <tr
                      key={rec.symbol}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                    >
                      <td className="p-3 text-gray-500 coin-symbol">#{index + 1}</td>
                      <td 
                        className="p-3 coin-symbol cursor-pointer hover:text-gray-200 transition"
                        onClick={() => onSymbolSelect && onSymbolSelect(rec.symbol)}
                      >
                        {rec.symbol}
                      </td>
                      <td className="p-3 text-right">{formatPrice(rec.currentPrice)}</td>
                      <td className="p-3 text-right">
                        <span className="font-semibold coin-symbol">{rec.score.toFixed(1)}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold coin-symbol ${
                          rec.recommendation === 'STRONG_BUY' ? 'bg-gray-700 text-gray-200' :
                          'bg-gray-800 text-gray-300'
                        }`}>
                          {rec.recommendation.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold">{formatPrice(rec.allocation)}</div>
                        <div className="text-xs text-gray-500">
                          {((rec.allocation / capital) * 100).toFixed(1)}%
                        </div>
                      </td>
                      <td className="p-3 text-right coin-symbol">
                        {rec.amount.toFixed(6)}
                      </td>
                      <td className={`p-3 text-right ${
                        rec.estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <div className="font-semibold">{formatPrice(rec.estimatedProfit)}</div>
                        <div className={`text-xs ${
                          rec.estimatedProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatPercent(rec.estimatedProfitPercent)}
                        </div>
                      </td>
                      <td className={`p-3 text-right ${
                        rec.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatPercent(rec.change24h)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

