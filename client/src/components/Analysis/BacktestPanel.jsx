import { useState } from 'react';

/**
 * BacktestPanel Component
 * 
 * Zeigt Backtest-Ergebnisse für ein Symbol:
 * - Win-Rate und Performance-Statistiken
 * - Entry Quality Analyse
 * - Signal-Historie
 */
export default function BacktestPanel({ symbol, interval = '4h' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({
    lookbackCandles: 500,
    holdPeriods: 24,
    signalType: 'STRONG_BUY'
  });
  const [showSignals, setShowSignals] = useState(false);

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        lookbackCandles: options.lookbackCandles,
        holdPeriods: options.holdPeriods,
        signalType: options.signalType
      });
      
      const response = await fetch(
        `http://localhost:5001/api/backtest/${symbol}/${interval}?${params}`
      );
      
      if (!response.ok) {
        throw new Error('Backtest fehlgeschlagen');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Win-Rate Farbe
   */
  const getWinRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (numRate >= 60) return 'text-green-400';
    if (numRate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  /**
   * Return Farbe
   */
  const getReturnColor = (ret) => {
    const numRet = parseFloat(ret);
    if (numRet > 0) return 'text-green-400';
    if (numRet < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>📈</span> Backtest
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Teste die historische Performance der Signale
        </p>
      </div>

      {/* Options */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Candles</label>
            <select
              value={options.lookbackCandles}
              onChange={(e) => setOptions({ ...options, lookbackCandles: parseInt(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
            >
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={750}>750</option>
              <option value={1000}>1000</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 block mb-1">Hold Period</label>
            <select
              value={options.holdPeriods}
              onChange={(e) => setOptions({ ...options, holdPeriods: parseInt(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
            >
              <option value={12}>12 Candles</option>
              <option value={24}>24 Candles</option>
              <option value={48}>48 Candles</option>
              <option value={72}>72 Candles</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 block mb-1">Signal Type</label>
            <select
              value={options.signalType}
              onChange={(e) => setOptions({ ...options, signalType: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
            >
              <option value="STRONG_BUY">Strong Buy</option>
              <option value="BUY">Buy + Strong Buy</option>
              <option value="STRONG_BUY_NOW">Strong Buy Now</option>
            </select>
          </div>
        </div>

        <button
          onClick={runBacktest}
          disabled={loading}
          className={`w-full py-2 rounded font-semibold transition ${
            loading 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {loading ? 'Läuft...' : 'Backtest starten'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border-b border-red-700">
          <div className="text-red-400">Fehler: {error}</div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="p-4 space-y-4">
          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400">Signale</div>
              <div className="text-2xl font-bold">{data.stats.totalSignals}</div>
            </div>
            <div className="bg-gray-700/50 rounded p-3">
              <div className="text-xs text-gray-400">Win-Rate</div>
              <div className={`text-2xl font-bold ${getWinRateColor(data.stats.winRate)}`}>
                {data.stats.winRate}%
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <div className="text-xs text-gray-400">Avg Return</div>
              <div className={`font-semibold ${getReturnColor(data.stats.avgReturn)}`}>
                {data.stats.avgReturn}%
              </div>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <div className="text-xs text-gray-400">Avg Win</div>
              <div className="font-semibold text-green-400">
                +{data.stats.avgWinReturn}%
              </div>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <div className="text-xs text-gray-400">Avg Loss</div>
              <div className="font-semibold text-red-400">
                {data.stats.avgLossReturn}%
              </div>
            </div>
          </div>

          {/* Advanced Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-700/30 rounded p-2">
              <div className="text-xs text-gray-400">Profit Factor</div>
              <div className={`font-semibold ${
                parseFloat(data.stats.profitFactor) > 1 ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.stats.profitFactor}
              </div>
            </div>
            <div className="bg-gray-700/30 rounded p-2">
              <div className="text-xs text-gray-400">Expectancy</div>
              <div className={`font-semibold ${getReturnColor(data.stats.expectancy)}`}>
                {data.stats.expectancy}%
              </div>
            </div>
            <div className="bg-gray-700/30 rounded p-2">
              <div className="text-xs text-gray-400">Max Win</div>
              <div className="font-semibold text-green-400">
                +{data.stats.maxWin}%
              </div>
            </div>
            <div className="bg-gray-700/30 rounded p-2">
              <div className="text-xs text-gray-400">Max Loss</div>
              <div className="font-semibold text-red-400">
                {data.stats.maxLoss}%
              </div>
            </div>
          </div>

          {/* Entry Quality Analysis */}
          {data.stats.entryQualityAnalysis && (
            <div className="bg-gray-700/30 rounded p-3">
              <div className="text-sm font-semibold text-gray-300 mb-2">
                📊 Entry Quality Analyse
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">High Quality Entries</div>
                  <div className="flex justify-between">
                    <span>{data.stats.entryQualityAnalysis.highQualitySignals} Signale</span>
                    <span className={getWinRateColor(data.stats.entryQualityAnalysis.highQualityWinRate)}>
                      {data.stats.entryQualityAnalysis.highQualityWinRate}% Win
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Low Quality Entries</div>
                  <div className="flex justify-between">
                    <span>{data.stats.entryQualityAnalysis.lowQualitySignals} Signale</span>
                    <span className={getWinRateColor(data.stats.entryQualityAnalysis.lowQualityWinRate)}>
                      {data.stats.entryQualityAnalysis.lowQualityWinRate}% Win
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RSI Analysis */}
          {data.stats.rsiAnalysis && (
            <div className="bg-gray-700/30 rounded p-3">
              <div className="text-sm font-semibold text-gray-300 mb-2">
                📉 RSI bei Entry
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">RSI &lt; 50 (Pullback)</div>
                  <div className="flex justify-between">
                    <span>{data.stats.rsiAnalysis.oversoldEntries} Signale</span>
                    <span className={getWinRateColor(data.stats.rsiAnalysis.oversoldWinRate)}>
                      {data.stats.rsiAnalysis.oversoldWinRate}% Win
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">RSI &gt; 70 (Überkauft)</div>
                  <div className="flex justify-between">
                    <span>{data.stats.rsiAnalysis.overboughtEntries} Signale</span>
                    <span className={getWinRateColor(data.stats.rsiAnalysis.overboughtWinRate)}>
                      {data.stats.rsiAnalysis.overboughtWinRate}% Win
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signal History Toggle */}
          <button
            onClick={() => setShowSignals(!showSignals)}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
          >
            {showSignals ? '▼ Signal-Historie verbergen' : '▶ Signal-Historie anzeigen'}
          </button>

          {/* Signal History */}
          {showSignals && data.signals && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.signals.slice(0, 20).map((signal, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded text-sm ${
                    signal.isWin ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">
                      {new Date(signal.timestamp).toLocaleDateString('de-DE')}
                    </span>
                    <span className={signal.isWin ? 'text-green-400' : 'text-red-400'}>
                      {signal.return > 0 ? '+' : ''}{signal.return.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    <span>Score: {signal.score}</span>
                    <span>Entry Q: {signal.entryQuality?.toFixed(0) || '-'}</span>
                    <span>RSI: {signal.rsi?.toFixed(0) || '-'}</span>
                  </div>
                </div>
              ))}
              {data.signals.length > 20 && (
                <div className="text-center text-gray-500 text-sm">
                  ... und {data.signals.length - 20} weitere Signale
                </div>
              )}
            </div>
          )}

          {/* Period Info */}
          <div className="text-xs text-gray-500 text-center">
            Zeitraum: {new Date(data.periodStart).toLocaleDateString('de-DE')} - {new Date(data.periodEnd).toLocaleDateString('de-DE')}
          </div>
        </div>
      )}
    </div>
  );
}
