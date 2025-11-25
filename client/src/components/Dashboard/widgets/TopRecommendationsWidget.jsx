/**
 * TopRecommendationsWidget
 * 
 * Zeigt die Top 5 Buy-Empfehlungen basierend auf Score
 */
export default function TopRecommendationsWidget({ data, onSymbolSelect, onRemove }) {
  if (!data.prices || !data.analyses) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-gray-400">Lade Empfehlungen...</div>
      </div>
    );
  }

  // Filtere und sortiere nach Score
  const recommendations = data.prices
    .slice(0, 20) // Top 20 für bessere Auswahl
    .map(coin => {
      const analysis = data.analyses[coin.symbol];
      if (!analysis || !analysis.recommendations) return null;
      
      const rec = analysis.recommendations;
      if (rec.score < 50 || (rec.recommendation !== 'BUY' && rec.recommendation !== 'STRONG_BUY')) {
        return null;
      }

      return {
        symbol: coin.symbol,
        price: coin.price,
        score: rec.score,
        recommendation: rec.recommendation,
        change24h: coin.change24h
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const formatPrice = (price) => {
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold coin-symbol">Top Empfehlungen</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Entfernen
          </button>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="text-gray-400 text-sm">Keine Buy-Empfehlungen verfügbar</div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.symbol}
              className="bg-gray-900 rounded p-3 hover:bg-gray-700 transition cursor-pointer"
              onClick={() => onSymbolSelect && onSymbolSelect(rec.symbol)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm coin-symbol">#{index + 1}</span>
                  <span className="font-semibold coin-symbol">{rec.symbol}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold coin-symbol ${
                    rec.recommendation === 'STRONG_BUY' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-300'
                  }`}>
                    {rec.recommendation.replace('_', ' ')}
                  </span>
                </div>
                <span className="font-semibold coin-symbol text-gray-300">
                  {rec.score.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{formatPrice(rec.price)}</span>
                <span className={rec.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatPercent(rec.change24h)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

