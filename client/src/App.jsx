import { useState, useEffect } from 'react';
import CryptoTable from './components/CryptoTable/CryptoTable';
import Portfolio from './components/Portfolio/Portfolio';
import TopPlayers from './components/TopPlayers/TopPlayers';
import CryptoDetail from './components/CryptoDetail/CryptoDetail';
import TradingCapital from './components/TradingCapital/TradingCapital';
import Dashboard from './components/Dashboard/Dashboard';
import Settings from './components/Settings/Settings';
import { healthCheck } from './services/api';
import { initAlertService, stopAlertService } from './services/alertService';
import { loadNotificationSettings } from './utils/storage';

/**
 * Haupt-App Komponente - Enhanced Version
 * 
 * Verwaltet Navigation zwischen den verschiedenen Views:
 * - Crypto Table (Hauptübersicht)
 * - Portfolio
 * - Top Players
 * 
 * Features:
 * - Tab-basierte Navigation
 * - Backend Health Check
 * - Error Handling
 * - NEU: Alert Service für Background-Notifications
 */
function App() {
  const [activeTab, setActiveTab] = useState('table');
  const [selectedSymbol, setSelectedSymbol] = useState(null); // Ausgewähltes Symbol für Detail-Ansicht
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
    // Prüfe alle 30 Sekunden
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * NEU: Initialisiere Alert Service beim App-Start
   */
  useEffect(() => {
    const settings = loadNotificationSettings();
    
    // Starte Alert Service wenn aktiviert und Permission vorhanden
    if (
      settings.enabled && 
      settings.backgroundPolling && 
      'Notification' in window && 
      Notification.permission === 'granted'
    ) {
      const intervalMs = (settings.pollingIntervalMinutes || 5) * 60 * 1000;
      initAlertService(intervalMs);
    }

    // Cleanup beim Unmount
    return () => {
      stopAlertService();
    };
  }, []);

  /**
   * NEU: Listener für Alert-Klicks (navigiert zum Coin)
   */
  useEffect(() => {
    const handleAlertClick = (event) => {
      const { symbol } = event.detail;
      if (symbol) {
        setSelectedSymbol(symbol);
      }
    };

    window.addEventListener('alert-click', handleAlertClick);
    return () => {
      window.removeEventListener('alert-click', handleAlertClick);
    };
  }, []);

  /**
   * Handle Portfolio Update (wenn Coin hinzugefügt wird)
   */
  const handlePortfolioUpdate = () => {
    // Wenn wir auf Portfolio-Tab sind, aktualisiere die Anzeige
    if (activeTab === 'portfolio') {
      // Portfolio-Komponente wird automatisch aktualisiert durch Polling
      // Hier könnten wir zusätzliche Aktionen durchführen
    }
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
    setSelectedSymbol(null); // Verlasse Detail-Ansicht falls aktiv
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Crypto Trend Trading</h1>
            <div className="flex items-center gap-4">
              {/* Backend Status */}
              {backendOnline ? (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Backend Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span>Backend Offline</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
          <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'table'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Crypto Table
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'portfolio'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('top-players')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'top-players'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Top Players
            </button>
            <button
              onClick={() => setActiveTab('trading-capital')}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'trading-capital'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Trading Capital
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-3 font-semibold transition flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-gray-900 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>⚙️</span>
              Einstellungen
            </button>
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
            {activeTab === 'table' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-2">Top 50 Coins</h2>
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
                  <h2 className="text-2xl font-semibold mb-2">Mein Portfolio</h2>
                  <p className="text-gray-400 text-sm">
                    Verwalte deine Coins und verfolge Gewinn/Verlust
                  </p>
                </div>
                <Portfolio onSymbolSelect={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'top-players' && (
              <div>
                <TopPlayers onSymbolSelect={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'trading-capital' && (
              <div>
                <TradingCapital onSymbolSelect={handleSymbolSelect} />
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div>
                <Dashboard 
                  onSymbolSelect={handleSymbolSelect}
                  onNavigate={handleNavigate}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
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
            Crypto Trend Trading App v2.0 - Enhanced Alerts & Entry Quality
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
