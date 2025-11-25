import { useState, useEffect } from 'react';
import { getTop50Prices, getAnalysis } from '../../services/api';
import { getTradingCapital, loadPortfolio, calculatePortfolioValue } from '../../utils/storage';
import { usePolling } from '../../hooks/usePolling';
import { loadDashboardLayout, saveDashboardLayout } from '../../utils/storage';
import TopRecommendationsWidget from './widgets/TopRecommendationsWidget';
import PortfolioSummaryWidget from './widgets/PortfolioSummaryWidget';
import MarketOverviewWidget from './widgets/MarketOverviewWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import WatchlistWidget from './widgets/WatchlistWidget';

/**
 * Dashboard Komponente
 * 
 * Hauptübersicht mit anpassbaren Widgets:
 * - Top Buy-Empfehlungen
 * - Portfolio-Performance
 * - Markt-Übersicht
 * - Schnellzugriff
 * 
 * Features:
 * - Customizable: Widgets hinzufügen/entfernen
 * - Layout-Persistenz (LocalStorage)
 * - Automatisches Polling
 * 
 * Props:
 * - onSymbolSelect: Callback für Symbol-Auswahl
 * - onNavigate: Callback für Navigation zu anderen Tabs (optional)
 */
export default function Dashboard({ onSymbolSelect, onNavigate }) {
  const [widgets, setWidgets] = useState([]);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [customizing, setCustomizing] = useState(false);
  const [data, setData] = useState({
    prices: [],
    analyses: {},
    portfolio: null,
    tradingCapital: 0
  });
  const [loading, setLoading] = useState(true);

  /**
   * Lade Dashboard-Layout und initialisiere Widgets
   */
  useEffect(() => {
    const savedLayout = loadDashboardLayout();
    if (savedLayout && savedLayout.length > 0) {
      setWidgets(savedLayout);
    } else {
      // Standard-Layout
      setWidgets([
        { id: 'top-recommendations', type: 'top-recommendations', visible: true },
        { id: 'portfolio-summary', type: 'portfolio-summary', visible: true },
        { id: 'market-overview', type: 'market-overview', visible: true },
        { id: 'quick-actions', type: 'quick-actions', visible: true },
        { id: 'watchlist', type: 'watchlist', visible: true }
      ]);
    }

    // Verfügbare Widgets
    setAvailableWidgets([
      { id: 'top-recommendations', name: 'Top Empfehlungen', description: 'Top 5 Buy-Empfehlungen' },
      { id: 'portfolio-summary', name: 'Portfolio Übersicht', description: 'Portfolio-Performance' },
      { id: 'market-overview', name: 'Markt-Übersicht', description: 'Markt-Statistiken' },
      { id: 'quick-actions', name: 'Schnellzugriff', description: 'Schnelle Aktionen' },
      { id: 'watchlist', name: 'Watchlist', description: 'Deine beobachteten Coins' }
    ]);
  }, []);

  /**
   * Lade alle Dashboard-Daten
   */
  const fetchData = async () => {
    try {
      // Hole Top 50 Coins
      const prices = await getTop50Prices();
      
      // Hole Trading Capital
      const tradingCapital = getTradingCapital();
      
      // Hole Portfolio
      const portfolio = loadPortfolio();
      let portfolioValue = null;
      if (portfolio.length > 0) {
        const priceMap = {};
        prices.forEach(coin => {
          priceMap[coin.symbol] = coin.price;
        });
        portfolioValue = calculatePortfolioValue(portfolio, priceMap);
      }

      // Hole Analysen für Top 10 Coins (für Top Recommendations)
      const top10 = prices.slice(0, 10);
      const analysisPromises = top10.map(async (coin) => {
        try {
          const analysis = await getAnalysis(coin.symbol, '1h');
          return { symbol: coin.symbol, analysis };
        } catch (err) {
          console.error(`Error analyzing ${coin.symbol}:`, err);
          return { symbol: coin.symbol, analysis: null };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      const analyses = {};
      analysisResults.forEach(({ symbol, analysis }) => {
        analyses[symbol] = analysis;
      });

      setData({
        prices,
        analyses,
        portfolio: portfolioValue,
        tradingCapital
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
   * Toggle Widget Sichtbarkeit
   */
  const toggleWidget = (widgetId) => {
    const updated = widgets.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    setWidgets(updated);
    saveDashboardLayout(updated);
  };

  /**
   * Widget hinzufügen
   */
  const addWidget = (widgetType) => {
    const exists = widgets.find(w => w.type === widgetType);
    if (exists) {
      // Wenn bereits vorhanden, mache es sichtbar
      toggleWidget(exists.id);
    } else {
      const newWidget = {
        id: `${widgetType}-${Date.now()}`,
        type: widgetType,
        visible: true
      };
      const updated = [...widgets, newWidget];
      setWidgets(updated);
      saveDashboardLayout(updated);
    }
  };

  /**
   * Widget entfernen
   */
  const removeWidget = (widgetId) => {
    const updated = widgets.filter(w => w.id !== widgetId);
    setWidgets(updated);
    saveDashboardLayout(updated);
  };

  /**
   * Rendere Widget basierend auf Typ
   */
  const renderWidget = (widget) => {
    if (!widget.visible) return null;

    const props = {
      data,
      onSymbolSelect,
      onNavigate,
      onRemove: customizing ? () => removeWidget(widget.id) : undefined
    };

    switch (widget.type) {
      case 'top-recommendations':
        return <TopRecommendationsWidget key={widget.id} {...props} />;
      case 'portfolio-summary':
        return <PortfolioSummaryWidget key={widget.id} {...props} />;
      case 'market-overview':
        return <MarketOverviewWidget key={widget.id} {...props} />;
      case 'quick-actions':
        return <QuickActionsWidget key={widget.id} {...props} />;
      case 'watchlist':
        return <WatchlistWidget key={widget.id} {...props} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header mit Customize-Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold coin-symbol mb-2">Dashboard</h2>
          <p className="text-gray-400 text-sm">
            Übersicht über deine wichtigsten Trading-Informationen
          </p>
        </div>
        <button
          onClick={() => setCustomizing(!customizing)}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${
            customizing
              ? 'bg-gray-700 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {customizing ? 'Fertig' : 'Anpassen'}
        </button>
      </div>

      {/* Widget-Auswahl (nur im Customize-Modus) */}
      {customizing && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-300">Widgets hinzufügen</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {availableWidgets.map(widget => {
              const isActive = widgets.some(w => w.type === widget.id && w.visible);
              return (
                <button
                  key={widget.id}
                  onClick={() => addWidget(widget.id)}
                  className={`p-3 rounded text-left transition ${
                    isActive
                      ? 'bg-gray-700 border-2 border-gray-500'
                      : 'bg-gray-900 border-2 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">{widget.name}</div>
                  <div className="text-xs text-gray-400">{widget.description}</div>
                  {isActive && (
                    <div className="text-xs text-gray-500 mt-2">✓ Aktiv</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget-Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widgets.map(widget => (
          <div key={widget.id} className="relative">
            {customizing && (
              <button
                onClick={() => removeWidget(widget.id)}
                className="absolute top-2 right-2 z-10 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold"
                title="Widget entfernen"
              >
                ×
              </button>
            )}
            {renderWidget(widget)}
          </div>
        ))}
      </div>

      {widgets.filter(w => w.visible).length === 0 && (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <div className="text-gray-400 mb-2">Keine Widgets aktiv</div>
          <div className="text-gray-500 text-sm">
            Klicke auf "Anpassen" um Widgets hinzuzufügen
          </div>
        </div>
      )}
    </div>
  );
}

