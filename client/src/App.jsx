import { useState, useEffect } from 'react';
import CryptoTable from './components/CryptoTable/CryptoTable';
import Portfolio from './components/Portfolio/Portfolio';
import TopPlayers from './components/TopPlayers/TopPlayers';
import CryptoDetail from './components/CryptoDetail/CryptoDetail';
import TradingCapital from './components/TradingCapital/TradingCapital';
import Dashboard from './components/Dashboard/Dashboard';
import Settings from './components/Settings/Settings';
import ScreenerPanel from './components/Screener/ScreenerPanel';
import BreakoutScanner from './components/Analysis/BreakoutScanner';
import { healthCheck } from './services/api';

/**
 * Haupt-App Komponente - v2.4
 * 
 * Verwaltet Navigation zwischen den verschiedenen Views:
 * - Dashboard
 * - Breakout Scanner (NEU)
 * - Screener
 * - Crypto Table (Hauptübersicht)
 * - Portfolio
 * - Top Players
 * - Trading Capital
 * - Settings
 * 
 * Features:
 * - Tab-basierte Navigation
 * - Backend Health Check
 * - Error Handling
 */
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [backendError, setBackendError] = useState(null);

  /**
   * Prüfe Backend-Verbindung
   */
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await healthCheck();
        setBackendOnline(true);
        setBackendError(null);
      } catch (error) {
        setBackendOnline(false);
        setBackendError('Backend nicht erreichbar. Stelle sicher, dass der Server läuft.');
        console.error('Backend health check failed:', error);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Handle Portfolio Update
   */
  const handlePortfolioUpdate = () => {
    // Portfolio-Komponente wird automatisch aktualisiert durch Polling
  };

  /**
   * Handle Symbol Selection (für Detail-Ansicht)
   */
  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
  };

  /**
   * Zurück zur Übersicht
   */
  const handleBack = () => {
    setSelectedSymbol(null);
  };

  /**
   * Handle Navigation (für Dashboard Quick Actions)
   */
  const handleNavigate = (tab) => {
    setActiveTab(tab);
    setSelectedSymbol(null);
  };

  // Tab-Konfiguration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'breakout', label: 'Breakout', icon: '🎯' },
    { id: 'screener', label: 'Screener', icon: '🔍' },
    { id: 'table', label: 'Alle Coins', icon: '📋' },
    { id: 'portfolio', label: 'Portfolio', icon: '💼' },
    { id: 'top-players', label: 'Top Players', icon: '🏆' },
    { id: 'trading-capital', label: 'Capital', icon: '💰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Crypto Trend Trading</h1>
            <div className="flex items-center gap-4">
              {/* Version Badge */}
              <span className="text-xs bg-gray-700 px-2 py-1 rounded">v2.4</span>
              
              {/* Backend Status */}
              <div className={`flex items-center gap-2 text-sm ${
                backendOnline ? 'text-green-400' : 'text-gray-500'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-green-400' : 'bg-gray-600'
                }`}></div>
                <span>{backendOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedSymbol(null);
                }}
                className={`px-4 py-3 font-semibold transition whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Backend Error Warning */}
        {backendError && (
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-6">
            <div className="text-gray-300 font-semibold">⚠️ Warnung</div>
            <div className="text-gray-400 text-sm mt-1">{backendError}</div>
            <div className="text-gray-500 text-xs mt-2">
              Stelle sicher, dass der Backend-Server auf Port 5001 läuft.
            </div>
          </div>
        )}

        {/* Detail-Ansicht */}
        {selectedSymbol ? (
          <CryptoDetail symbol={selectedSymbol} onBack={handleBack} />
        ) : (
          /* Tab Content */
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                onSymbolSelect={handleSymbolSelect}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'breakout' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">🎯 Breakout Scanner</h2>
                  <p className="text-gray-400 text-sm">
                    Finde Coins vor dem Ausbruch - Squeeze, Accumulation, Konsolidierung
                  </p>
                </div>
                <BreakoutScanner onSelectCoin={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'screener' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">🔍 Screener</h2>
                  <p className="text-gray-400 text-sm">
                    Scanne alle Coins nach deinen Kriterien - Score, RSI, Pattern, Divergenzen
                  </p>
                </div>
                <ScreenerPanel onSelectCoin={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'table' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">📋 Top 50 Coins</h2>
                  <p className="text-gray-400 text-sm">
                    Übersicht aller Coins mit Live-Preisen und Buy/Sell-Empfehlungen
                  </p>
                </div>
                <CryptoTable 
                  onAddToPortfolio={handlePortfolioUpdate}
                  onSymbolSelect={handleSymbolSelect}
                />
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">💼 Mein Portfolio</h2>
                  <p className="text-gray-400 text-sm">
                    Verwalte deine Coins und verfolge Gewinn/Verlust
                  </p>
                </div>
                <Portfolio onSymbolSelect={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'top-players' && (
              <TopPlayers onSymbolSelect={handleSymbolSelect} />
            )}

            {activeTab === 'trading-capital' && (
              <TradingCapital onSymbolSelect={handleSymbolSelect} />
            )}

            {activeTab === 'settings' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">⚙️ Einstellungen</h2>
                  <p className="text-gray-400 text-sm">
                    Verwalte deine Watchlist und Notification-Einstellungen
                  </p>
                </div>
                <Settings onSymbolSelect={handleSymbolSelect} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center text-gray-400 text-sm">
            Crypto Trend Trading App v2.4 - Daten von Binance API
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
