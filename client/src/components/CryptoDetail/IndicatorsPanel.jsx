import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';

/**
 * IndicatorsPanel Komponente
 * 
 * Zeigt alle technischen Indikatoren in separaten Charts:
 * - MACD (Histogram + Signal Line)
 * - RSI
 * - ADX (+DI/-DI)
 * 
 * Props:
 * - analysis: Analyse-Objekt mit Indikatoren
 */
export default function IndicatorsPanel({ analysis }) {
  if (!analysis || !analysis.candles) {
    return null;
  }

  const candles = analysis.candles;
  const indicators = analysis.indicators;

  // Bereite Daten für Indikatoren-Charts vor
  const indicatorData = candles.map((candle, index) => {
    const time = new Date(candle.time);
    const timeLabel = format(time, 'dd.MM HH:mm');

    const data = {
      time: timeLabel,
      timestamp: candle.time
    };

    // MACD
    if (indicators?.macd) {
      if (indicators.macd.macdLine && indicators.macd.macdLine[index] !== null) {
        data.macdLine = indicators.macd.macdLine[index];
      }
      if (indicators.macd.signalLine && indicators.macd.signalLine[index] !== null) {
        data.signalLine = indicators.macd.signalLine[index];
      }
      if (indicators.macd.histogram && indicators.macd.histogram[index] !== null) {
        data.histogram = indicators.macd.histogram[index];
      }
    }

    // RSI
    if (indicators?.rsi && indicators.rsi[index] !== null) {
      data.rsi = indicators.rsi[index];
    }

    // ADX
    if (indicators?.adx) {
      if (indicators.adx.adx && indicators.adx.adx[index] !== null) {
        data.adx = indicators.adx.adx[index];
      }
      if (indicators.adx.plusDI && indicators.adx.plusDI[index] !== null) {
        data.plusDI = indicators.adx.plusDI[index];
      }
      if (indicators.adx.minusDI && indicators.adx.minusDI[index] !== null) {
        data.minusDI = indicators.adx.minusDI[index];
      }
    }

    // ATR
    if (indicators?.atr && indicators.atr[index] !== null) {
      data.atr = indicators.atr[index];
    }

    return data;
  });

  // Filtere Daten, die keine Indikator-Werte haben
  const macdData = indicatorData.filter(d => d.macdLine !== undefined || d.signalLine !== undefined);
  const rsiData = indicatorData.filter(d => d.rsi !== undefined);
  const adxData = indicatorData.filter(d => d.adx !== undefined);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold coin-symbol">Technische Indikatoren</h3>

      {/* MACD Chart */}
      {macdData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 text-gray-300">MACD (Moving Average Convergence Divergence)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={macdData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
              <Bar dataKey="histogram" fill="#60A5FA" opacity={0.6} name="Histogram" />
              <Line type="monotone" dataKey="macdLine" stroke="#F9FAFB" strokeWidth={2} dot={false} name="MACD Line" />
              <Line type="monotone" dataKey="signalLine" stroke="#FBBF24" strokeWidth={1.5} dot={false} name="Signal Line" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* RSI Chart */}
      {rsiData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 text-gray-300">RSI (Relative Strength Index)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={rsiData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend />
              <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#EF4444' }} />
              <ReferenceLine y={30} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#10B981' }} />
              <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="2 2" opacity={0.5} />
              <Line type="monotone" dataKey="rsi" stroke="#60A5FA" strokeWidth={2} dot={false} name="RSI" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ADX Chart */}
      {adxData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 text-gray-300">ADX (Average Directional Index)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={adxData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend />
              <ReferenceLine y={25} stroke="#FBBF24" strokeDasharray="3 3" label={{ value: 'Strong Trend', fill: '#FBBF24' }} />
              <ReferenceLine y={20} stroke="#6B7280" strokeDasharray="2 2" opacity={0.5} label={{ value: 'Trend Threshold', fill: '#6B7280' }} />
              <Line type="monotone" dataKey="adx" stroke="#F9FAFB" strokeWidth={2} dot={false} name="ADX" />
              {adxData[0]?.plusDI !== undefined && (
                <Line type="monotone" dataKey="plusDI" stroke="#10B981" strokeWidth={1.5} dot={false} name="+DI" />
              )}
              {adxData[0]?.minusDI !== undefined && (
                <Line type="monotone" dataKey="minusDI" stroke="#EF4444" strokeWidth={1.5} dot={false} name="-DI" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

