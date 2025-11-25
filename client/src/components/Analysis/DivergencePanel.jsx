import { useState, useEffect } from 'react';

/**
 * DivergencePanel Component
 * 
 * Zeigt Divergenz-Analyse mit:
 * - RSI Divergenzen
 * - MACD Divergenzen
 * - Kombiniertes Signal
 * - Visuelle Darstellung
 */
export default function DivergencePanel({ symbol, interval = '4h' }) {
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
          `http://localhost:5001/api/divergence/${symbol}/${interval}?lookback=100`
        );

        if (!response.ok) {
          throw new Error('Divergenz-Analyse fehlgeschlagen');
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
  }, [symbol, interval]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-gray-400 text-center">
          Analysiere Divergenzen...
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

  const { rsi, macd, combined, currentPrice, currentRSI } = data;

  /**
   * Signal Badge Config
   */
  const getSignalConfig = (signal) => {
    switch (signal) {
      case 'BULLISH':
        return { bg: 'bg-green-600', icon: '🟢', text: 'Bullish' };
      case 'BEARISH':
        return { bg: 'bg-red-600', icon: '🔴', text: 'Bearish' };
      default:
        return { bg: 'bg-gray-600', icon: '⏸️', text: 'Neutral' };
    }
  };

  /**
   * Divergenz-Typ Badge
   */
  const getDivergenceTypeBadge = (type) => {
    switch (type) {
      case 'BULLISH':
        return { bg: 'bg-green-600', label: 'Bullish', desc: 'Trendumkehr ↑' };
      case 'BEARISH':
        return { bg: 'bg-red-600', label: 'Bearish', desc: 'Trendumkehr ↓' };
      case 'HIDDEN_BULLISH':
        return { bg: 'bg-green-500', label: 'Hidden Bullish', desc: 'Trend-Fortsetzung ↑' };
      case 'HIDDEN_BEARISH':
        return { bg: 'bg-red-500', label: 'Hidden Bearish', desc: 'Trend-Fortsetzung ↓' };
      default:
        return { bg: 'bg-gray-600', label: type, desc: '' };
    }
  };

  const signalConfig = getSignalConfig(combined.signal);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📉</span> Divergenz-Erkennung
          </h3>
          <div className="text-sm text-gray-400">
            RSI: <span className={currentRSI > 70 ? 'text-red-400' : currentRSI < 30 ? 'text-green-400' : 'text-white'}>
              {currentRSI?.toFixed(1) || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Combined Signal */}
      <div className="p-4">
        {combined.hasDivergence ? (
          <div className={`${signalConfig.bg} rounded-lg p-4 mb-4`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{signalConfig.icon}</span>
              <div>
                <div className="font-bold text-lg">{combined.message}</div>
                <div className="text-sm opacity-80">
                  {combined.confirmation && '✅ Bestätigt durch RSI + MACD'}
                  {!combined.confirmation && `${combined.totalDivergences} Divergenz(en) erkannt`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4 text-center">
            <span className="text-gray-400">Keine aktive Divergenz erkannt</span>
            <p className="text-sm text-gray-500 mt-1">
              Das System überwacht kontinuierlich auf Divergenz-Signale
            </p>
          </div>
        )}

        {/* Score */}
        {combined.hasDivergence && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Divergenz-Score</span>
              <span>{combined.score}/100</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  combined.score >= 60 ? 'bg-green-500' :
                  combined.score <= 40 ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${combined.score}%` }}
              />
            </div>
          </div>
        )}

        {/* RSI Divergenzen */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📊</span> RSI Divergenzen
            {rsi.found && (
              <span className="bg-blue-600 px-2 py-0.5 rounded text-xs">
                {rsi.divergences.length}
              </span>
            )}
          </div>

          {rsi.divergences.length > 0 ? (
            <div className="space-y-2">
              {rsi.divergences.slice(0, 3).map((div, index) => {
                const typeBadge = getDivergenceTypeBadge(div.type);
                return (
                  <div
                    key={index}
                    className="bg-gray-700/50 rounded p-3 border-l-4"
                    style={{
                      borderColor: div.type.includes('BULLISH') ? '#22c55e' : '#ef4444'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`${typeBadge.bg} px-2 py-0.5 rounded text-xs font-semibold`}>
                        {typeBadge.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        vor {div.candlesAgo} Kerzen
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">{div.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stärke: {div.strength.toFixed(0)}% | {div.signal}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-700/30 rounded p-3">
              Keine RSI Divergenz erkannt
            </div>
          )}
        </div>

        {/* MACD Divergenzen */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📈</span> MACD Divergenzen
            {macd.found && (
              <span className="bg-blue-600 px-2 py-0.5 rounded text-xs">
                {macd.divergences.length}
              </span>
            )}
          </div>

          {macd.divergences.length > 0 ? (
            <div className="space-y-2">
              {macd.divergences.slice(0, 3).map((div, index) => {
                const typeBadge = getDivergenceTypeBadge(div.type);
                return (
                  <div
                    key={index}
                    className="bg-gray-700/50 rounded p-3 border-l-4"
                    style={{
                      borderColor: div.type.includes('BULLISH') ? '#22c55e' : '#ef4444'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`${typeBadge.bg} px-2 py-0.5 rounded text-xs font-semibold`}>
                        {typeBadge.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        vor {div.candlesAgo} Kerzen
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">{div.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stärke: {div.strength.toFixed(0)}% | {div.signal}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-700/30 rounded p-3">
              Keine MACD Divergenz erkannt
            </div>
          )}
        </div>

        {/* Erklärung */}
        <div className="bg-gray-900/50 rounded p-3 text-xs text-gray-500">
          <div className="font-semibold text-gray-400 mb-1">Was sind Divergenzen?</div>
          <p>
            <strong>Bullish:</strong> Preis macht tieferes Tief, Indikator höheres Tief → Kaufsignal
          </p>
          <p>
            <strong>Bearish:</strong> Preis macht höheres Hoch, Indikator tieferes Hoch → Verkaufssignal
          </p>
          <p className="mt-1 text-gray-600">
            Stärkste Signale wenn RSI + MACD beide die gleiche Divergenz zeigen.
          </p>
        </div>
      </div>
    </div>
  );
}
