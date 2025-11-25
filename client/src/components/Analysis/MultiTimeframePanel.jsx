import { useState, useEffect } from 'react';

/**
 * MultiTimeframePanel Component
 * 
 * Zeigt Multi-Timeframe Analyse mit:
 * - Score-Vergleich über Timeframes
 * - Alignment-Status
 * - Empfohlene Aktion
 * - Confidence Level
 */
export default function MultiTimeframePanel({ symbol, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(
          `http://localhost:5001/api/multi-timeframe/${symbol}?timeframes=1h,4h,1d`
        );
        
        if (!response.ok) {
          throw new Error('Multi-Timeframe Analyse fehlgeschlagen');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-gray-400 text-center">
          Lade Multi-Timeframe Analyse...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-700">
        <div className="text-red-400 text-center">
          Fehler: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { timeframes, summary, recommendedAction, actionReason, warnings } = data;

  /**
   * Confidence Badge Farbe
   */
  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'VERY_HIGH': return 'bg-green-600 text-white';
      case 'HIGH': return 'bg-green-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-gray-900';
      default: return 'bg-gray-600 text-white';
    }
  };

  /**
   * Action Badge Config
   */
  const actionConfig = {
    'STRONG_BUY_NOW': { color: 'bg-green-600', icon: '🟢', label: 'Jetzt kaufen' },
    'BUY_PARTIAL': { color: 'bg-green-500', icon: '🟡', label: 'Teilposition' },
    'WATCH_FOR_PULLBACK': { color: 'bg-yellow-500 text-gray-900', icon: '👀', label: 'Warte auf Pullback' },
    'WATCH': { color: 'bg-yellow-600', icon: '👁️', label: 'Beobachten' },
    'SELL': { color: 'bg-red-500', icon: '🔻', label: 'Verkaufen' },
    'WAIT': { color: 'bg-gray-600', icon: '⏸️', label: 'Abwarten' }
  };

  const action = actionConfig[recommendedAction] || actionConfig['WAIT'];

  /**
   * Score Farbe
   */
  const getScoreColor = (score) => {
    if (score >= 60) return 'text-green-400';
    if (score >= 50) return 'text-green-300';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  /**
   * Recommendation Badge
   */
  const getRecBadge = (rec) => {
    const config = {
      'STRONG_BUY': { bg: 'bg-green-600', text: 'SB' },
      'BUY': { bg: 'bg-green-500', text: 'B' },
      'HOLD': { bg: 'bg-yellow-600', text: 'H' },
      'SELL': { bg: 'bg-red-500', text: 'S' },
      'STRONG_SELL': { bg: 'bg-red-600', text: 'SS' }
    };
    const c = config[rec] || config['HOLD'];
    return (
      <span className={`${c.bg} px-2 py-0.5 rounded text-xs font-bold text-white`}>
        {c.text}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>📊</span> Multi-Timeframe Analyse
        </h3>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 space-y-4">
        {/* Empfohlene Aktion */}
        <div className={`${action.color} rounded-lg p-4`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{action.icon}</span>
            <div>
              <div className="font-bold text-lg">{action.label}</div>
              <div className="text-sm opacity-80">{actionReason}</div>
            </div>
          </div>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">Avg Score</div>
            <div className={`text-2xl font-bold ${getScoreColor(summary.avgScore)}`}>
              {summary.avgScore}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">Entry Quality</div>
            <div className={`text-2xl font-bold ${getScoreColor(summary.avgEntryQuality)}`}>
              {summary.avgEntryQuality}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">Confidence</div>
            <div className={`inline-block px-2 py-1 rounded text-sm font-semibold ${getConfidenceColor(summary.confidence)}`}>
              {summary.confidence}
            </div>
          </div>
        </div>

        {/* Timeframe Details */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-300">Timeframe Breakdown</div>
          
          {Object.entries(timeframes).map(([tf, result]) => {
            if (!result) return null;
            
            return (
              <div 
                key={tf}
                className="flex items-center justify-between bg-gray-700/30 rounded p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-mono w-8">{tf}</span>
                  {getRecBadge(result.recommendation)}
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Score</div>
                    <div className={`font-semibold ${getScoreColor(result.score)}`}>
                      {result.score}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Entry</div>
                    <div className={`font-semibold ${getScoreColor(result.entryQuality)}`}>
                      {result.entryQuality}
                    </div>
                  </div>
                  <div className="text-right w-12">
                    <div className="text-xs text-gray-400">RSI</div>
                    <div className={`font-semibold ${
                      result.indicators.rsi > 70 ? 'text-red-400' :
                      result.indicators.rsi < 30 ? 'text-green-400' : 'text-gray-300'
                    }`}>
                      {result.indicators.rsi?.toFixed(0) || '-'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Alignment Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Alignment:</span>
          <span className={`font-semibold ${
            summary.allStrongBuy ? 'text-green-400' :
            summary.allBullish ? 'text-green-300' :
            summary.allBearish ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {summary.alignmentType.replace(/_/g, ' ')}
          </span>
          {summary.allStrongBuy && <span>✅</span>}
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-300">⚠️ Warnungen</div>
            {warnings.map((warning, index) => (
              <div 
                key={index}
                className={`text-sm p-2 rounded ${
                  warning.severity === 'HIGH' 
                    ? 'bg-red-900/30 text-red-400 border border-red-700' 
                    : 'bg-yellow-900/30 text-yellow-400 border border-yellow-700'
                }`}
              >
                <span className="text-xs text-gray-500 mr-2">[{warning.timeframe}]</span>
                {warning.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
