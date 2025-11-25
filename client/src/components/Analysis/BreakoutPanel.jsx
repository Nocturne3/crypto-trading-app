import { useState, useEffect } from 'react';

/**
 * BreakoutPanel Component
 * 
 * Zeigt Breakout-Analyse für einen einzelnen Coin:
 * - Breakout-Score & Wahrscheinlichkeit
 * - Volatilitäts-Squeeze Status
 * - Volume-Anomalien
 * - Konsolidierung
 * - Aktiver Breakout
 */
export default function BreakoutPanel({ symbol, interval = '4h' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBreakoutData = async () => {
      if (!symbol) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `http://localhost:5001/api/breakout/${symbol}/${interval}`
        );
        
        if (!response.ok) {
          throw new Error('Breakout-Analyse fehlgeschlagen');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakoutData();
  }, [symbol, interval]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Analysiere Breakout-Potenzial...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-700">
        <div className="text-red-400">❌ {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { score, probability, probabilityLabel, likelyDirection, summary, signals, details, levels } = data;

  // Score-Farbe
  const getScoreColor = (s) => {
    if (s >= 70) return 'text-green-400';
    if (s >= 50) return 'text-yellow-400';
    if (s >= 30) return 'text-orange-400';
    return 'text-gray-400';
  };

  // Probability Badge
  const getProbabilityBadge = (prob) => {
    switch (prob) {
      case 'HIGH': return { bg: 'bg-green-600', text: 'Hoch' };
      case 'MEDIUM': return { bg: 'bg-yellow-600', text: 'Mittel' };
      default: return { bg: 'bg-gray-600', text: 'Gering' };
    }
  };

  const probBadge = getProbabilityBadge(probability);

  // Direction Icon
  const getDirectionIcon = (dir) => {
    if (dir === 'UP') return '↑';
    if (dir === 'DOWN') return '↓';
    return '↔';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>🎯</span> Breakout-Analyse
          </h3>
          <span className="text-sm text-gray-400">{interval}</span>
        </div>
      </div>

      {/* Score & Summary */}
      <div className={`p-4 ${score >= 70 ? 'bg-green-900/30' : score >= 50 ? 'bg-yellow-900/30' : 'bg-gray-900/30'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            {/* Score */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}
              </div>
              <div className="text-xs text-gray-400">Score</div>
            </div>
            
            {/* Probability Badge */}
            <span className={`${probBadge.bg} px-3 py-1 rounded-full text-sm font-semibold`}>
              {probBadge.text}
            </span>
            
            {/* Direction */}
            {likelyDirection !== 'UNKNOWN' && (
              <div className={`text-2xl ${likelyDirection === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                {getDirectionIcon(likelyDirection)}
              </div>
            )}
          </div>
          
          {/* Active Breakout Badge */}
          {signals.some(s => s.type === 'ACTIVE_BREAKOUT') && (
            <div className="bg-green-600 animate-pulse px-3 py-1 rounded text-sm font-bold">
              🚀 AKTIV!
            </div>
          )}
        </div>
        
        {/* Summary */}
        <div className="text-sm">
          {summary}
        </div>
      </div>

      {/* Signals Grid */}
      {signals.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Erkannte Signale</h4>
          <div className="space-y-2">
            {signals.map((signal, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-lg ${
                  signal.type === 'ACTIVE_BREAKOUT' ? 'bg-green-900/40 border border-green-700' :
                  signal.type === 'SQUEEZE' ? 'bg-purple-900/40 border border-purple-700' :
                  signal.type === 'VOLUME' ? 'bg-blue-900/40 border border-blue-700' :
                  'bg-gray-900/40 border border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>
                      {signal.type === 'ACTIVE_BREAKOUT' ? '🚀' :
                       signal.type === 'SQUEEZE' ? '🔥' :
                       signal.type === 'VOLUME' ? '📊' :
                       signal.type === 'CONSOLIDATION' ? '📦' : '📌'}
                    </span>
                    <span className="font-semibold text-sm">
                      {signal.type === 'ACTIVE_BREAKOUT' ? 'Aktiver Breakout' :
                       signal.type === 'SQUEEZE' ? 'Volatilitäts-Squeeze' :
                       signal.type === 'VOLUME' ? 'Volume-Signal' :
                       signal.type === 'CONSOLIDATION' ? 'Konsolidierung' : signal.type}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${getScoreColor(signal.score)}`}>
                    {signal.score}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {signal.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="p-4 border-t border-gray-700 grid grid-cols-2 gap-4">
        {/* Squeeze Details */}
        {details.squeeze && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Bollinger Squeeze</div>
            <div className="flex items-center gap-2">
              <span className={details.squeeze.detected ? 'text-purple-400' : 'text-gray-500'}>
                {details.squeeze.detected ? '🔥 Aktiv' : '😴 Inaktiv'}
              </span>
              {details.squeeze.detected && (
                <span className="text-xs text-gray-400">
                  ({details.squeeze.squeezeDuration} Kerzen)
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Bandwidth: {details.squeeze.bandwidthRatio * 100}% vom Ø
            </div>
          </div>
        )}
        
        {/* Volume Details */}
        {details.volume && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Volumen</div>
            <div className="flex items-center gap-2">
              <span className={details.volume.detected ? 'text-blue-400' : 'text-gray-500'}>
                {details.volume.isAccumulating ? '📈 Accumulation' :
                 details.volume.isSpike ? '⚡ Spike' :
                 details.volume.volumeTrend === 'RISING' ? '📊 Steigend' : '😴 Normal'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {details.volume.volumeRatio * 100}% vom Ø
            </div>
          </div>
        )}
        
        {/* Consolidation Details */}
        {details.consolidation && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Konsolidierung</div>
            <div className="flex items-center gap-2">
              <span className={details.consolidation.detected ? 'text-yellow-400' : 'text-gray-500'}>
                {details.consolidation.detected ? '📦 Aktiv' : '😴 Keine'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Range: {details.consolidation.rangePercent}%
              {details.consolidation.detected && (
                <span> • {details.consolidation.consolidationDuration} Kerzen</span>
              )}
            </div>
          </div>
        )}
        
        {/* Levels */}
        {levels && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Breakout-Levels</div>
            {levels.resistanceBreakout && (
              <div className="text-xs">
                <span className="text-red-400">Resistance:</span>{' '}
                <span className="text-white">${levels.resistanceBreakout.toFixed(6)}</span>
              </div>
            )}
            {levels.supportBreakdown && (
              <div className="text-xs">
                <span className="text-green-400">Support:</span>{' '}
                <span className="text-white">${levels.supportBreakdown.toFixed(6)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/30">
        <div className="text-xs text-gray-500">
          <strong>Wie interpretiere ich das?</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li><span className="text-purple-400">Squeeze</span> = Volatilität komprimiert → Grosser Move kommt</li>
            <li><span className="text-blue-400">Accumulation</span> = Big Money sammelt ein → Bullish</li>
            <li><span className="text-yellow-400">Konsolidierung</span> = Preis in enger Range → Breakout naht</li>
            <li><span className="text-green-400">Score ≥ 70</span> = Breakout sehr wahrscheinlich</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
