/**
 * MarketOverviewWidget
 * 
 * Zeigt Markt-Übersicht und Statistiken
 */
export default function MarketOverviewWidget({ data, onSymbolSelect, onRemove }) {
  const prices = data.prices || [];

  if (prices.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-gray-400">Lade Marktdaten...</div>
      </div>
    );
  }

  // Berechne Markt-Statistiken
  const totalMarketCap = prices.reduce((sum, coin) => sum + (coin.price * coin.volume24h), 0);
  const avgChange24h = prices.reduce((sum, coin) => sum + coin.change24h, 0) / prices.length;
  const gainers = prices.filter(coin => coin.change24h > 0).length;
  const losers = prices.filter(coin => coin.change24h < 0).length;
  
  // Top Gainer/Loser
  const topGainer = [...prices].sort((a, b) => b.change24h - a.change24h)[0];
  const topLoser = [...prices].sort((a, b) => a.change24h - b.change24h)[0];

  const formatPrice = (price) => {
    if (!price) return '-';
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold coin-symbol">Markt-Übersicht</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Entfernen
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-xs mb-1">Durchschnitt 24h</div>
            <div className={`text-lg font-semibold coin-symbol ${
              avgChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercent(avgChange24h)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Coins analysiert</div>
            <div className="text-lg font-semibold coin-symbol">{prices.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-xs mb-1">Gewinner</div>
            <div className="text-lg font-semibold coin-symbol text-green-400">
              {gainers}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Verlierer</div>
            <div className="text-lg font-semibold coin-symbol text-red-400">
              {losers}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-700 space-y-3">
          <div>
            <div className="text-gray-400 text-xs mb-1">Top Gainer</div>
            <div
              className="flex items-center justify-between cursor-pointer hover:text-gray-200 transition"
              onClick={() => onSymbolSelect && onSymbolSelect(topGainer.symbol)}
            >
              <span className="font-semibold coin-symbol">{topGainer.symbol}</span>
              <span className="text-green-400 font-semibold">
                {formatPercent(topGainer.change24h)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Top Verlierer</div>
            <div
              className="flex items-center justify-between cursor-pointer hover:text-gray-200 transition"
              onClick={() => onSymbolSelect && onSymbolSelect(topLoser.symbol)}
            >
              <span className="font-semibold coin-symbol">{topLoser.symbol}</span>
              <span className="text-red-400 font-semibold">
                {formatPercent(topLoser.change24h)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

