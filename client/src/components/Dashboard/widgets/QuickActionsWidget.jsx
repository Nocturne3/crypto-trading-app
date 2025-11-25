/**
 * QuickActionsWidget
 * 
 * Schnellzugriff auf wichtige Funktionen
 */
export default function QuickActionsWidget({ data, onSymbolSelect, onRemove, onNavigate }) {
  const portfolio = data.portfolio;
  const tradingCapital = data.tradingCapital;

  const actions = [
    {
      label: 'Crypto Table',
      description: 'Alle Coins anzeigen',
      tab: 'table'
    },
    {
      label: 'Portfolio',
      description: 'Portfolio verwalten',
      tab: 'portfolio'
    },
    {
      label: 'Trading Capital',
      description: 'Kapital verwalten',
      tab: 'trading-capital'
    },
    {
      label: 'Top Players',
      description: 'Top Performer',
      tab: 'top-players'
    }
  ];

  const handleAction = (tab) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold coin-symbol">Schnellzugriff</h3>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            Entfernen
          </button>
        )}
      </div>

      <div className="space-y-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => handleAction(action.tab)}
            className="w-full text-left p-3 bg-gray-900 rounded hover:bg-gray-700 transition"
          >
            <div className="font-semibold text-sm mb-1">{action.label}</div>
            <div className="text-xs text-gray-400">{action.description}</div>
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-400 text-xs mb-1">Portfolio Coins</div>
            <div className="font-semibold coin-symbol">
              {portfolio?.items.length || 0}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Trading Kapital</div>
            <div className="font-semibold coin-symbol">
              {tradingCapital > 0 ? `$${tradingCapital.toLocaleString()}` : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

