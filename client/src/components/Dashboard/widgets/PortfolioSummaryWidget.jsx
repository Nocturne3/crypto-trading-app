/**
 * PortfolioSummaryWidget
 * 
 * Zeigt Portfolio-Performance auf einen Blick
 */
export default function PortfolioSummaryWidget({ data, onSymbolSelect, onRemove }) {
  const portfolio = data.portfolio;
  const tradingCapital = data.tradingCapital;

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
        <h3 className="text-lg font-semibold coin-symbol">Portfolio</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Entfernen
          </button>
        )}
      </div>

      {!portfolio || portfolio.items.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">Portfolio ist leer</div>
          <div className="text-gray-500 text-sm">
            Füge Coins über die Crypto Table hinzu
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-xs mb-1">Gesamtwert</div>
              <div className="text-xl font-semibold coin-symbol">
                {formatPrice(portfolio.totalValue)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Gewinn/Verlust</div>
              <div className={`text-xl font-semibold coin-symbol ${
                portfolio.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatPrice(portfolio.totalProfit)}
              </div>
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">G/V %</div>
            <div className={`text-2xl font-bold coin-symbol ${
              portfolio.totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercent(portfolio.totalProfitPercent)}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-700">
            <div className="text-gray-400 text-xs mb-2">Top Positionen</div>
            <div className="space-y-2">
              {portfolio.items
                .sort((a, b) => b.value - a.value)
                .slice(0, 3)
                .map(item => (
                  <div
                    key={item.symbol}
                    className="flex justify-between text-sm cursor-pointer hover:text-gray-200 transition"
                    onClick={() => onSymbolSelect && onSymbolSelect(item.symbol)}
                  >
                    <span className="coin-symbol">{item.symbol}</span>
                    <span className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatPercent(item.profitPercent)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {tradingCapital > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-gray-400 text-xs mb-1">Trading Kapital</div>
          <div className="text-lg font-semibold coin-symbol">
            {formatPrice(tradingCapital)}
          </div>
        </div>
      )}
    </div>
  );
}

