import { useState } from 'react';

/**
 * RecommendationsPanel - Enhanced Version
 * 
 * Zeigt Buy/Sell Empfehlungen mit:
 * - Score und Signal-Status
 * - Entry Quality Score (NEU)
 * - Überhitzungs-Warnungen (NEU)
 * - Score Breakdown
 * - Stop-Loss Empfehlungen
 * - Volumen-Analyse (NEU)
 */
export default function RecommendationsPanel({ recommendations, interval }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  if (!recommendations) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-gray-400 text-center">Lade Empfehlungen...</div>
      </div>
    );
  }

  const { 
    score, 
    recommendation, 
    signalStatus,
    entryQuality,
    warnings = [],
    breakdown, 
    stopLoss, 
    currentPrice,
    volumeAnalysis,
    indicators 
  } = recommendations;

  /**
   * Farbe basierend auf Score
   */
  const getScoreColor = (value) => {
    if (value >= 60) return 'text-green-400';
    if (value >= 50) return 'text-green-300';
    if (value >= 40) return 'text-yellow-400';
    if (value >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  /**
   * Hintergrundfarbe basierend auf Score
   */
  const getScoreBgColor = (value) => {
    if (value >= 60) return 'bg-green-600';
    if (value >= 50) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-600';
    if (value >= 30) return 'bg-orange-600';
    return 'bg-red-600';
  };

  /**
   * Entry Quality Farbe
   */
  const getEntryQualityColor = (value) => {
    if (value >= 60) return 'bg-green-500 text-white';
    if (value >= 45) return 'bg-yellow-500 text-gray-900';
    return 'bg-red-500 text-white';
  };

  /**
   * Entry Quality Label
   */
  const getEntryQualityLabel = (value) => {
    if (value >= 60) return 'Guter Einstieg';
    if (value >= 45) return 'Akzeptabel';
    return 'Schlechter Einstieg';
  };

  /**
   * Signal Status Konfiguration
   */
  const signalStatusConfig = {
    'STRONG_BUY_NOW': { 
      label: 'Jetzt kaufen', 
      color: 'bg-green-600 text-white',
      icon: '🟢',
      description: 'Starker Trend + guter Einstiegspunkt'
    },
    'BUY_PARTIAL': { 
      label: 'Teilposition möglich', 
      color: 'bg-green-500 text-white',
      icon: '🟡',
      description: 'Trend gut, Entry akzeptabel'
    },
    'WATCH_FOR_PULLBACK': { 
      label: 'Watchlist - Warte auf Pullback', 
      color: 'bg-yellow-500 text-gray-900',
      icon: '👀',
      description: 'Trend stark, aber überkauft - warte auf Rücksetzer'
    },
    'HOLD': { 
      label: 'Halten', 
      color: 'bg-gray-600 text-white',
      icon: '⏸️',
      description: 'Keine klare Richtung'
    },
    'SELL': { 
      label: 'Verkaufen', 
      color: 'bg-orange-500 text-white',
      icon: '🔻',
      description: 'Schwächezeichen erkannt'
    },
    'STRONG_SELL': { 
      label: 'Stark verkaufen', 
      color: 'bg-red-600 text-white',
      icon: '🔴',
      description: 'Klarer Abwärtstrend'
    }
  };

  const statusConfig = signalStatusConfig[signalStatus] || signalStatusConfig['HOLD'];

  /**
   * Warning Severity Farbe
   */
  const getWarningSeverityColor = (severity) => {
    if (severity === 'HIGH') return 'text-red-400 bg-red-900/30 border-red-700';
    if (severity === 'MEDIUM') return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
    return 'text-gray-400 bg-gray-800 border-gray-700';
  };

  /**
   * Empfehlungs-Text (Legacy)
   */
  const getRecommendationText = (rec) => {
    switch (rec) {
      case 'STRONG_BUY': return 'Strong Buy';
      case 'BUY': return 'Buy';
      case 'HOLD': return 'Hold';
      case 'SELL': return 'Sell';
      case 'STRONG_SELL': return 'Strong Sell';
      default: return rec;
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
   * Formatiere Prozent
   */
  const formatPercent = (value) => {
    if (!value && value !== 0) return '-';
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Header mit Interval */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Buy/Sell Empfehlung</h3>
        <span className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
          {interval}
        </span>
      </div>

      {/* Haupt-Score Card */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-gray-400 text-sm">Score</div>
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {score.toFixed(1)}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-lg ${getScoreBgColor(score)}`}>
            <span className="text-lg font-semibold text-white">
              {getRecommendationText(recommendation)}
            </span>
          </div>
        </div>

        {/* NEU: Signal Status */}
        <div className={`${statusConfig.color} rounded-lg p-3 mb-4`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{statusConfig.icon}</span>
            <div>
              <div className="font-semibold">{statusConfig.label}</div>
              <div className="text-sm opacity-80">{statusConfig.description}</div>
            </div>
          </div>
        </div>

        {/* NEU: Entry Quality */}
        <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg mb-4">
          <div>
            <div className="text-gray-400 text-sm">Entry Quality</div>
            <div className="text-sm text-gray-300">{getEntryQualityLabel(entryQuality)}</div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-semibold ${getEntryQualityColor(entryQuality)}`}>
            {entryQuality?.toFixed(1) || '-'}
          </div>
        </div>

        {/* Aktuelle Indikatoren */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-700/50 rounded p-2">
            <div className="text-gray-400 text-xs">RSI</div>
            <div className={`font-semibold ${
              indicators?.rsi > 70 ? 'text-red-400' : 
              indicators?.rsi < 30 ? 'text-green-400' : 'text-gray-200'
            }`}>
              {indicators?.rsi?.toFixed(1) || '-'}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-2">
            <div className="text-gray-400 text-xs">ADX</div>
            <div className={`font-semibold ${
              indicators?.adx > 25 ? 'text-green-400' : 'text-gray-200'
            }`}>
              {indicators?.adx?.toFixed(1) || '-'}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded p-2">
            <div className="text-gray-400 text-xs">MACD Hist</div>
            <div className={`font-semibold ${
              indicators?.macdHistogram > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {indicators?.macdHistogram?.toFixed(4) || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* NEU: Warnungen */}
      {warnings && warnings.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span>⚠️</span> Warnungen
          </h4>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div 
                key={index}
                className={`p-2 rounded border ${getWarningSeverityColor(warning.severity)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">
                    {warning.severity === 'HIGH' ? '🔴' : '🟡'}
                  </span>
                  <div className="text-sm">{warning.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEU: Volumen-Analyse */}
      {volumeAnalysis && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Volumen-Analyse</h4>
          <div className="flex items-center justify-between">
            <div className="text-gray-400 text-sm">Bullish Volume Ratio</div>
            <div className={`font-semibold ${
              volumeAnalysis.bullishRatio > 55 ? 'text-green-400' :
              volumeAnalysis.bullishRatio < 45 ? 'text-red-400' : 'text-gray-300'
            }`}>
              {volumeAnalysis.bullishRatio}%
            </div>
          </div>
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${
                volumeAnalysis.bullishRatio > 55 ? 'bg-green-500' :
                volumeAnalysis.bullishRatio < 45 ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${volumeAnalysis.bullishRatio}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Bearish</span>
            <span>Bullish</span>
          </div>
        </div>
      )}

      {/* Stop-Loss Empfehlungen */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Stop-Loss Empfehlungen</h4>
        
        <div className="space-y-3">
          {/* Long Position */}
          <div className="bg-green-900/20 border border-green-800 rounded p-3">
            <div className="text-green-400 text-xs font-medium mb-1">Für Long-Position (Kauf)</div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">{formatPrice(stopLoss?.stopLossLong)}</span>
              <span className="text-gray-400 text-sm">
                Abstand: {formatPercent(stopLoss?.stopLossPercentLong)}
              </span>
            </div>
          </div>
          
          {/* Short Position */}
          <div className="bg-red-900/20 border border-red-800 rounded p-3">
            <div className="text-red-400 text-xs font-medium mb-1">Für Short-Position (Verkauf)</div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">{formatPrice(stopLoss?.stopLossShort)}</span>
              <span className="text-gray-400 text-sm">
                Abstand: {formatPercent(stopLoss?.stopLossPercentShort)}
              </span>
            </div>
          </div>
          
          {/* ATR Info */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>ℹ️</span>
            <span>Basierend auf ATR(14): {stopLoss?.atr?.toFixed(6) || '-'}</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 hover:text-white transition"
        >
          <span>Score Breakdown</span>
          <span>{showBreakdown ? '▼' : '▶'}</span>
        </button>
        
        {showBreakdown && (
          <div className="mt-4 space-y-2">
            {/* Long-Term Trend */}
            <ScoreBreakdownRow 
              label="Langfristiger Trend" 
              value={breakdown?.longTermTrend} 
              weight="30%"
            />
            
            {/* MACD */}
            <ScoreBreakdownRow 
              label="MACD" 
              value={breakdown?.macd} 
              weight="20%"
            />
            
            {/* EMA Cross */}
            <ScoreBreakdownRow 
              label="EMA Cross" 
              value={breakdown?.emaCross} 
              weight="20%"
            />
            
            {/* ADX */}
            <ScoreBreakdownRow 
              label="ADX" 
              value={breakdown?.adx} 
              weight="15%"
            />
            
            {/* RSI */}
            <ScoreBreakdownRow 
              label="RSI" 
              value={breakdown?.rsi} 
              weight="10%"
            />
            
            {/* Bollinger */}
            <ScoreBreakdownRow 
              label="Bollinger Bands" 
              value={breakdown?.bollinger} 
              weight="5%"
            />

            {/* Volume (NEU) */}
            {breakdown?.volume !== undefined && (
              <ScoreBreakdownRow 
                label="Volumen" 
                value={breakdown?.volume} 
                weight="Info"
              />
            )}
          </div>
        )}
      </div>

      {/* Info Text */}
      <div className="text-xs text-gray-500 text-center">
        Aktueller Preis: {formatPrice(currentPrice)}
      </div>
    </div>
  );
}

/**
 * Score Breakdown Row Komponente
 */
function ScoreBreakdownRow({ label, value, weight }) {
  const getBarColor = (val) => {
    if (val >= 60) return 'bg-green-500';
    if (val >= 50) return 'bg-green-400';
    if (val >= 40) return 'bg-yellow-500';
    if (val >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTextColor = (val) => {
    if (val >= 60) return 'text-green-400';
    if (val >= 50) return 'text-green-300';
    if (val >= 40) return 'text-yellow-400';
    if (val >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">
          {label} <span className="text-gray-600">({weight})</span>
        </span>
        <span className={getTextColor(value)}>{value?.toFixed(1) || '-'}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getBarColor(value)} transition-all duration-300`}
          style={{ width: `${value || 0}%` }}
        />
      </div>
    </div>
  );
}
