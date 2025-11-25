import { useState, useEffect } from 'react';

/**
 * PatternPanel Component
 * 
 * Zeigt:
 * - Support/Resistance Levels
 * - Double Bottom/Top Pattern
 * - Visuelle Darstellung der Levels
 */
export default function PatternPanel({ symbol, interval = '4h' }) {
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
          `http://localhost:5001/api/patterns/${symbol}/${interval}?lookback=200`
        );

        if (!response.ok) {
          throw new Error('Pattern-Analyse fehlgeschlagen');
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
          Analysiere Pattern...
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

  const { supportResistance, doubleBottom, doubleTop, summary, currentPrice } = data;
  const { support, resistance, nearest } = supportResistance;

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
   * Signal Badge
   */
  const getSignalBadge = (signal) => {
    switch (signal) {
      case 'BULLISH':
        return { bg: 'bg-green-600', icon: '🟢', text: 'Bullish' };
      case 'POTENTIAL_BULLISH':
        return { bg: 'bg-green-600/50', icon: '🟡', text: 'Potentiell Bullish' };
      case 'BEARISH':
        return { bg: 'bg-red-600', icon: '🔴', text: 'Bearish' };
      case 'POTENTIAL_BEARISH':
        return { bg: 'bg-red-600/50', icon: '🟡', text: 'Potentiell Bearish' };
      default:
        return { bg: 'bg-gray-600', icon: '⏸️', text: 'Neutral' };
    }
  };

  const signalBadge = getSignalBadge(summary.primarySignal);

  /**
   * Stärke-Farbe
   */
  const getStrengthColor = (strength) => {
    if (strength >= 70) return 'text-green-400';
    if (strength >= 50) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📐</span> Support/Resistance & Pattern
          </h3>
          <div className="text-sm text-gray-400">
            Preis: <span className="text-white font-semibold">{formatPrice(currentPrice)}</span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Summary Signal */}
        {(summary.hasPattern || summary.srPosition === 'AT_SUPPORT' || summary.srPosition === 'AT_RESISTANCE') && (
          <div className={`${signalBadge.bg} rounded-lg p-4 mb-4`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{signalBadge.icon}</span>
              <div>
                <div className="font-bold">{summary.message}</div>
                {summary.riskReward && (
                  <div className="text-sm opacity-80 mt-1">
                    Risk/Reward Ratio: {summary.riskReward.toFixed(2)}:1
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Support/Resistance Visualization */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span>📊</span> Support & Resistance Levels
          </h4>

          {/* Visual Level Display */}
          <div className="bg-gray-900/50 rounded-lg p-4">
            {/* Resistance Levels (von oben nach unten) */}
            {resistance.slice().reverse().map((level, index) => (
              <div
                key={`res-${index}`}
                className="flex items-center justify-between py-2 border-b border-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-red-400 font-semibold">R{resistance.length - index}</span>
                </div>
                <div className="text-white font-mono">{formatPrice(level.price)}</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">{level.touches}x berührt</span>
                  <span className={getStrengthColor(level.strength)}>
                    {level.strength}%
                  </span>
                  <span className="text-red-400">+{Math.abs(level.distancePercent)}%</span>
                </div>
              </div>
            ))}

            {/* Current Price */}
            <div className="flex items-center justify-between py-3 bg-blue-600/20 -mx-4 px-4 my-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400 font-semibold">PREIS</span>
              </div>
              <div className="text-white font-mono font-bold">{formatPrice(currentPrice)}</div>
              <div className="text-sm text-blue-400">Aktuell</div>
            </div>

            {/* Support Levels (von oben nach unten) */}
            {support.map((level, index) => (
              <div
                key={`sup-${index}`}
                className="flex items-center justify-between py-2 border-b border-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-green-400 font-semibold">S{index + 1}</span>
                </div>
                <div className="text-white font-mono">{formatPrice(level.price)}</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">{level.touches}x berührt</span>
                  <span className={getStrengthColor(level.strength)}>
                    {level.strength}%
                  </span>
                  <span className="text-green-400">-{Math.abs(level.distancePercent)}%</span>
                </div>
              </div>
            ))}

            {/* Keine Levels */}
            {support.length === 0 && resistance.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                Keine klaren S/R Levels erkannt
              </div>
            )}
          </div>

          {/* Nearest Levels Info */}
          {(nearest.support || nearest.resistance) && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {nearest.support && (
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                  <div className="text-xs text-green-400 mb-1">Nächster Support</div>
                  <div className="font-bold text-green-400">{formatPrice(nearest.support.price)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.abs(nearest.support.distancePercent)}% entfernt • {nearest.support.touches}x getestet
                  </div>
                </div>
              )}
              {nearest.resistance && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                  <div className="text-xs text-red-400 mb-1">Nächster Widerstand</div>
                  <div className="font-bold text-red-400">{formatPrice(nearest.resistance.price)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.abs(nearest.resistance.distancePercent)}% entfernt • {nearest.resistance.touches}x getestet
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Double Bottom Pattern */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📈</span> Double Bottom (W-Formation)
            {doubleBottom.found && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                doubleBottom.bestPattern?.confirmed ? 'bg-green-600' : 'bg-yellow-600'
              }`}>
                {doubleBottom.bestPattern?.confirmed ? 'Bestätigt' : 'In Bildung'}
              </span>
            )}
          </h4>

          {doubleBottom.found && doubleBottom.bestPattern ? (
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-green-400 font-semibold mb-1">
                    {doubleBottom.bestPattern.description}
                  </div>
                  <div className="text-sm text-gray-400">
                    Stärke: <span className={getStrengthColor(doubleBottom.bestPattern.strength)}>
                      {doubleBottom.bestPattern.strength}%
                    </span>
                  </div>
                </div>
                <div className="text-3xl">📈</div>
              </div>

              {/* Pattern Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Tief 1</div>
                  <div className="text-white">{formatPrice(doubleBottom.bestPattern.low1.price)}</div>
                  <div className="text-xs text-gray-500">vor {doubleBottom.bestPattern.low1.candlesAgo} Kerzen</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Tief 2</div>
                  <div className="text-white">{formatPrice(doubleBottom.bestPattern.low2.price)}</div>
                  <div className="text-xs text-gray-500">vor {doubleBottom.bestPattern.low2.candlesAgo} Kerzen</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Neckline</div>
                  <div className="text-yellow-400">{formatPrice(doubleBottom.bestPattern.neckline)}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Kursziel</div>
                  <div className="text-green-400">{formatPrice(doubleBottom.bestPattern.targetPrice)}</div>
                  <div className="text-xs text-green-400">+{doubleBottom.bestPattern.targetPercent}%</div>
                </div>
              </div>

              {/* ASCII Visualization */}
              <div className="mt-3 bg-gray-900 rounded p-3 font-mono text-xs text-gray-400">
                <pre>{`
     Neckline (${formatPrice(doubleBottom.bestPattern.neckline)})
        ----/\\----
           /  \\
    W     /    \\    ← Du bist hier
         /      \\
        V        V
    Tief 1    Tief 2
                `.trim()}</pre>
              </div>
            </div>
          ) : (
            <div className="bg-gray-700/30 rounded-lg p-3 text-sm text-gray-500">
              Kein Double Bottom Pattern erkannt
            </div>
          )}
        </div>

        {/* Double Top Pattern */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <span>📉</span> Double Top (M-Formation)
            {doubleTop.found && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                doubleTop.bestPattern?.confirmed ? 'bg-red-600' : 'bg-yellow-600'
              }`}>
                {doubleTop.bestPattern?.confirmed ? 'Bestätigt' : 'In Bildung'}
              </span>
            )}
          </h4>

          {doubleTop.found && doubleTop.bestPattern ? (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-red-400 font-semibold mb-1">
                    {doubleTop.bestPattern.description}
                  </div>
                  <div className="text-sm text-gray-400">
                    Stärke: <span className={getStrengthColor(doubleTop.bestPattern.strength)}>
                      {doubleTop.bestPattern.strength}%
                    </span>
                  </div>
                </div>
                <div className="text-3xl">📉</div>
              </div>

              {/* Pattern Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Hoch 1</div>
                  <div className="text-white">{formatPrice(doubleTop.bestPattern.high1.price)}</div>
                  <div className="text-xs text-gray-500">vor {doubleTop.bestPattern.high1.candlesAgo} Kerzen</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Hoch 2</div>
                  <div className="text-white">{formatPrice(doubleTop.bestPattern.high2.price)}</div>
                  <div className="text-xs text-gray-500">vor {doubleTop.bestPattern.high2.candlesAgo} Kerzen</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Neckline</div>
                  <div className="text-yellow-400">{formatPrice(doubleTop.bestPattern.neckline)}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Kursziel</div>
                  <div className="text-red-400">{formatPrice(doubleTop.bestPattern.targetPrice)}</div>
                  <div className="text-xs text-red-400">{doubleTop.bestPattern.targetPercent}%</div>
                </div>
              </div>

              {/* ASCII Visualization */}
              <div className="mt-3 bg-gray-900 rounded p-3 font-mono text-xs text-gray-400">
                <pre>{`
    Hoch 1    Hoch 2
        Λ        Λ
    M  / \\      / \\
      /   \\    /   \\
     /     \\  /     \\ ← Du bist hier
    ----\\  /----
        Neckline (${formatPrice(doubleTop.bestPattern.neckline)})
                `.trim()}</pre>
              </div>
            </div>
          ) : (
            <div className="bg-gray-700/30 rounded-lg p-3 text-sm text-gray-500">
              Kein Double Top Pattern erkannt
            </div>
          )}
        </div>

        {/* Erklärung */}
        <div className="bg-gray-900/50 rounded p-3 text-xs text-gray-500">
          <div className="font-semibold text-gray-400 mb-1">Wie nutze ich diese Levels?</div>
          <p><strong>Support:</strong> Kaufzone - Preis hat hier oft Halt gefunden</p>
          <p><strong>Resistance:</strong> Verkaufszone - Preis hat hier oft gedreht</p>
          <p><strong>Double Bottom:</strong> W-Formation = bullishes Umkehr-Signal</p>
          <p><strong>Double Top:</strong> M-Formation = bearishes Umkehr-Signal</p>
          <p className="mt-1 text-gray-600">
            Stärke basiert auf Anzahl der Berührungen und Aktualität. Bestätigte Pattern sind zuverlässiger.
          </p>
        </div>
      </div>
    </div>
  );
}
