import { useState, useEffect } from 'react';
import { getAnalysis, getTop50Prices } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import PriceChart from './PriceChart';
import IndicatorsPanel from './IndicatorsPanel';
import RecommendationsPanel from './RecommendationsPanel';
import MultiTimeframePanel from '../Analysis/MultiTimeframePanel';
import BacktestPanel from '../Analysis/BacktestPanel';
import DivergencePanel from '../Analysis/DivergencePanel';
import PatternPanel from '../Analysis/PatternPanel';
import BreakoutPanel from '../Analysis/BreakoutPanel';

/**
 * CryptoDetail Komponente - v2.4
 * 
 * Zeigt detaillierte Informationen zu einer einzelnen Crypto:
 * - Live Preis und 24h Statistiken
 * - Preis-Chart mit Candlesticks
 * - Alle technischen Indikatoren (MACD, RSI, EMA, SMA, Bollinger, ADX, ATR)
 * - Buy/Sell Recommendations mit Entry Quality
 * - Multi-Timeframe Analyse
 * - Backtesting
 * - Divergenz-Erkennung
 * - Support/Resistance & Pattern
 * - Breakout-Erkennung (NEU)
 * - Stop-Loss Empfehlungen
 * 
 * Features:
 * - Automatisches Polling für Live-Updates
 * - Zeitrahmen-Auswahl (1h, 4h, 1d)
 * - Interaktive Charts
 * - Tab-Navigation für erweiterte Analysen
 */
export default function CryptoDetail({ symbol, onBack }) {
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [interval, setInterval] = useState('4h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Active Tab für erweiterte Analysen
  const [activeTab, setActiveTab] = useState('recommendations');

  /**
   * Lade Preis und Analyse-Daten
   */
  const fetchData = async () => {
    try {
      setError(null);

      // Hole aktuellen Preis
      const prices = await getTop50Prices();
      const coin = prices.find(p => p.symbol === symbol);
      
      if (!coin) {
        setError(`Coin ${symbol} nicht gefunden`);
        setLoading(false);
        return;
      }

      setCurrentPrice(coin);

      // Hole vollständige Analyse
      const analysisData = await getAnalysis(symbol, interval);
      setAnalysis(analysisData);
      setPriceData(analysisData);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching detail data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchData();
  }, [symbol, interval]);

  // Polling alle 2 Minuten
  usePolling(fetchData, 120000);

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
   * Formatiere Prozent
   */
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Lade Daten...</div>
      </div>
    );
  }

  if (error || !analysis || !currentPrice) {
    return (
      <div className="p-8">
        <button
          onClick={onBack}
          className="mb-4 text-gray-400 hover:text-white transition"
        >
          ← Zurück
        </button>
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
          <div className="text-gray-300 font-semibold">Fehler</div>
          <div className="text-gray-400 text-sm mt-1">{error || 'Keine Daten verfügbar'}</div>
        </div>
      </div>
    );
  }

  const recommendations = analysis.recommendations;
  const candles = analysis.candles;

  // Tab Configuration - NEU: Breakout hinzugefügt
  const tabs = [
    { id: 'recommendations', label: 'Empfehlung', icon: '📊' },
    { id: 'breakout', label: 'Breakout', icon: '🎯' },
    { id: 'patterns', label: 'S/R & Pattern', icon: '📐' },
    { id: 'divergence', label: 'Divergenz', icon: '📉' },
    { id: 'multiTimeframe', label: 'Multi-TF', icon: '🕐' },
    { id: 'backtest', label: 'Backtest', icon: '📈' },
  ];

  return (
    <div>
      {/* Header mit Navigation */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-gray-400 hover:text-white transition"
        >
          ← Zurück
        </button>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold coin-symbol mb-2">{symbol}</h1>
            <div className="text-2xl font-semibold">
              {formatPrice(currentPrice.price)}
            </div>
            <div className={`text-sm mt-1 ${
              currentPrice.change24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercent(currentPrice.change24h)} (24h)
            </div>
          </div>

          {/* Zeitrahmen-Auswahl */}
          <div className="flex gap-2">
            {['1h', '4h', '1d'].map((int) => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={`px-4 py-2 rounded text-sm font-semibold transition ${
                  interval === int
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {int}
              </button>
            ))}
          </div>
        </div>

        {/* 24h Statistiken */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">24h High</div>
            <div className="text-lg font-semibold">{formatPrice(currentPrice.high24h)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">24h Low</div>
            <div className="text-lg font-semibold">{formatPrice(currentPrice.low24h)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">24h Volumen</div>
            <div className="text-lg font-semibold">${(currentPrice.volume24h / 1000000).toFixed(2)}M</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Aktueller Score</div>
            <div className={`text-lg font-semibold ${
              recommendations?.score >= 60 ? 'text-green-400' :
              recommendations?.score >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {recommendations?.score !== null && recommendations?.score !== undefined
                ? recommendations.score.toFixed(1)
                : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mb-6">
        {activeTab === 'recommendations' && recommendations && (
          <RecommendationsPanel 
            recommendations={recommendations}
            interval={interval}
          />
        )}
        
        {activeTab === 'breakout' && (
          <BreakoutPanel symbol={symbol} interval={interval} />
        )}
        
        {activeTab === 'patterns' && (
          <PatternPanel symbol={symbol} interval={interval} />
        )}
        
        {activeTab === 'divergence' && (
          <DivergencePanel symbol={symbol} interval={interval} />
        )}
        
        {activeTab === 'multiTimeframe' && (
          <MultiTimeframePanel symbol={symbol} />
        )}
        
        {activeTab === 'backtest' && (
          <BacktestPanel symbol={symbol} interval={interval} />
        )}
      </div>

      {/* Chart */}
      <div className="mb-6">
        <PriceChart
          candles={candles}
          analysis={analysis}
          interval={interval}
        />
      </div>

      {/* Indikatoren Panel */}
      <IndicatorsPanel analysis={analysis} />
    </div>
  );
}
