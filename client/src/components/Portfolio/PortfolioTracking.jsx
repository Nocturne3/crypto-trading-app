import { useState, useEffect } from 'react';
import { getTop50Prices } from '../../services/api';
import { loadPortfolio, calculatePortfolioValue } from '../../utils/storage';
import { 
  loadTradeHistory, 
  addTradeToHistory, 
  removeTradeFromHistory,
  calculateTradeStatistics,
  loadPortfolioSnapshots,
  savePortfolioSnapshot
} from '../../utils/tradeHistory';
import { usePolling } from '../../hooks/usePolling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

/**
 * Portfolio Tracking Komponente
 * 
 * Zeigt:
 * - Trade-Historie (alle Käufe/Verkäufe)
 * - Performance-Chart (Portfolio-Wert über Zeit)
 * - Detaillierte Statistiken
 * - Trade-Management
 */
export default function PortfolioTracking() {
  const [tradeHistory, setTradeHistory] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState([]);
  const [currentPortfolioValue, setCurrentPortfolioValue] = useState(null);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [newTrade, setNewTrade] = useState({
    type: 'BUY',
    symbol: '',
    amount: '',
    price: '',
    notes: ''
  });

  /**
   * Lade alle Tracking-Daten
   */
  const fetchData = async () => {
    try {
      // Lade Trade-Historie
      const history = loadTradeHistory();
      setTradeHistory(history);
      
      // Berechne Statistiken
      const stats = calculateTradeStatistics(history);
      setStatistics(stats);
      
      // Lade Portfolio-Snapshots
      const snapshots = loadPortfolioSnapshots();
      setPortfolioSnapshots(snapshots);
      
      // Berechne aktuellen Portfolio-Wert
      const portfolio = loadPortfolio();
      if (portfolio.length > 0) {
        const prices = await getTop50Prices();
        const priceMap = {};
        prices.forEach(coin => {
          priceMap[coin.symbol] = coin.price;
        });
        
        const portfolioValue = calculatePortfolioValue(portfolio, priceMap);
        setCurrentPortfolioValue(portfolioValue);
        
        // Erstelle Snapshot (alle 5 Minuten)
        const lastSnapshot = snapshots[snapshots.length - 1];
        const now = new Date();
        const shouldCreateSnapshot = !lastSnapshot || 
          (now - new Date(lastSnapshot.timestamp)) > 5 * 60 * 1000;
        
        if (shouldCreateSnapshot) {
          savePortfolioSnapshot({
            totalValue: portfolioValue.totalValue,
            totalCost: portfolioValue.totalCost,
            totalProfit: portfolioValue.totalProfit,
            totalProfitPercent: portfolioValue.totalProfitPercent
          });
          
          // Aktualisiere Snapshots
          const updatedSnapshots = loadPortfolioSnapshots();
          setPortfolioSnapshots(updatedSnapshots);
        }
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchData();
  }, []);

  // Polling alle 2 Minuten
  usePolling(fetchData, 120000);

  /**
   * Füge neuen Trade hinzu
   */
  const handleAddTrade = () => {
    if (!newTrade.symbol || !newTrade.amount || !newTrade.price) {
      alert('Bitte fülle alle Felder aus');
      return;
    }

    const trade = {
      type: newTrade.type,
      symbol: newTrade.symbol.toUpperCase(),
      amount: parseFloat(newTrade.amount),
      price: parseFloat(newTrade.price),
      totalValue: parseFloat(newTrade.amount) * parseFloat(newTrade.price),
      notes: newTrade.notes || undefined
    };

    addTradeToHistory(trade);
    setTradeHistory(loadTradeHistory());
    setStatistics(calculateTradeStatistics(loadTradeHistory()));
    
    // Reset Form
    setNewTrade({
      type: 'BUY',
      symbol: '',
      amount: '',
      price: '',
      notes: ''
    });
    setShowAddTrade(false);
  };

  /**
   * Entferne Trade
   */
  const handleRemoveTrade = (tradeId) => {
    if (window.confirm('Möchtest du diesen Trade wirklich löschen?')) {
      removeTradeFromHistory(tradeId);
      setTradeHistory(loadTradeHistory());
      setStatistics(calculateTradeStatistics(loadTradeHistory()));
    }
  };

  /**
   * Formatiere Preis
   */
  const formatPrice = (price) => {
    if (!price) return '-';
    if (price >= 1) {
      return `$${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(6)}`;
  };

  /**
   * Formatiere Datum
   */
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // Bereite Chart-Daten vor
  const chartData = portfolioSnapshots
    .filter(snapshot => snapshot.timestamp) // Filtere ungültige Snapshots
    .map(snapshot => {
      try {
        return {
          date: format(new Date(snapshot.timestamp), 'dd.MM HH:mm'),
          timestamp: snapshot.timestamp,
          value: snapshot.totalValue || 0,
          cost: snapshot.totalCost || 0,
          profit: snapshot.totalProfit || 0
        };
      } catch (error) {
        console.error('Error formatting snapshot date:', error);
        return null;
      }
    })
    .filter(Boolean); // Entferne null Werte

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold coin-symbol mb-2">Portfolio Tracking</h2>
          <p className="text-gray-400 text-sm">
            Detaillierte Analyse deiner Trades und Performance
          </p>
        </div>
        <button
          onClick={() => setShowAddTrade(!showAddTrade)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
        >
          {showAddTrade ? 'Abbrechen' : '+ Trade hinzufügen'}
        </button>
      </div>

      {/* Add Trade Form */}
      {showAddTrade && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Neuen Trade hinzufügen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Typ</label>
              <select
                value={newTrade.type}
                onChange={(e) => setNewTrade({ ...newTrade, type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              >
                <option value="BUY">Kauf</option>
                <option value="SELL">Verkauf</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Symbol</label>
              <input
                type="text"
                value={newTrade.symbol}
                onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value })}
                placeholder="BTC"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Menge</label>
              <input
                type="number"
                value={newTrade.amount}
                onChange={(e) => setNewTrade({ ...newTrade, amount: e.target.value })}
                placeholder="0.1"
                step="0.000001"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Preis (USD)</label>
              <input
                type="number"
                value={newTrade.price}
                onChange={(e) => setNewTrade({ ...newTrade, price: e.target.value })}
                placeholder="50000"
                step="0.01"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-400 text-sm mb-2">Notizen (optional)</label>
              <input
                type="text"
                value={newTrade.notes}
                onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                placeholder="Zusätzliche Informationen..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleAddTrade}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
            >
              Trade speichern
            </button>
          </div>
        </div>
      )}

      {/* Statistiken */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-semibold coin-symbol">
              {statistics.completedTrades > 0 ? `${statistics.winRate.toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statistics.completedTrades > 0 
                ? `${statistics.winningTrades} / ${statistics.completedTrades} Trades`
                : 'Keine abgeschlossenen Trades'
              }
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Gesamt Profit</div>
            <div className={`text-2xl font-semibold coin-symbol ${
              statistics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {statistics.completedTrades > 0 ? formatPrice(statistics.totalProfit) : '-'}
            </div>
            {statistics.completedTrades === 0 && statistics.totalTrades > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {statistics.openPositions} offene Position{statistics.openPositions !== 1 ? 'en' : ''}
              </div>
            )}
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Ø Profit/Trade</div>
            <div className={`text-2xl font-semibold coin-symbol ${
              statistics.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {statistics.completedTrades > 0 ? formatPrice(statistics.avgProfit) : '-'}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Abgeschlossene Trades</div>
            <div className="text-2xl font-semibold coin-symbol">
              {statistics.completedTrades}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statistics.totalTrades} insgesamt
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Portfolio Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#D1D5DB' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#60A5FA" 
                strokeWidth={2}
                name="Portfolio Wert"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="cost" 
                stroke="#9CA3AF" 
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Einsatz"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade Historie */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Trade-Historie</h3>
        {tradeHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Noch keine Trades vorhanden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-gray-400 font-semibold">Datum</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Typ</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Symbol</th>
                  <th className="text-right p-3 text-gray-400 font-semibold">Menge</th>
                  <th className="text-right p-3 text-gray-400 font-semibold">Preis</th>
                  <th className="text-right p-3 text-gray-400 font-semibold">Gesamtwert</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Notizen</th>
                  <th className="text-center p-3 text-gray-400 font-semibold">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="p-3 text-gray-400 text-sm">{formatDate(trade.timestamp)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold coin-symbol ${
                        trade.type === 'BUY' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="p-3 coin-symbol font-semibold">{trade.symbol}</td>
                    <td className="p-3 text-right">{trade.amount.toFixed(6)}</td>
                    <td className="p-3 text-right">{formatPrice(trade.price)}</td>
                    <td className="p-3 text-right font-semibold">{formatPrice(trade.totalValue)}</td>
                    <td className="p-3 text-gray-500 text-sm">{trade.notes || '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveTrade(trade.id)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Best/Worst Trades */}
      {statistics && statistics.bestTrade && statistics.worstTrade && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-300">Bester Trade</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol:</span>
                <span className="font-semibold coin-symbol">{statistics.bestTrade.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Profit:</span>
                <span className="font-semibold text-green-400">{formatPrice(statistics.bestTrade.profit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Profit %:</span>
                <span className="font-semibold text-green-400">
                  +{statistics.bestTrade.profitPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-500">Schlechtester Trade</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol:</span>
                <span className="font-semibold coin-symbol">{statistics.worstTrade.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Verlust:</span>
                <span className="font-semibold text-red-400">{formatPrice(statistics.worstTrade.profit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Verlust %:</span>
                <span className="font-semibold text-red-400">
                  {statistics.worstTrade.profitPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

