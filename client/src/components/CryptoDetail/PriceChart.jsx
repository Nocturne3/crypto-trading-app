import {
  ComposedChart,
  Line,
  Area,
  Bar,
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
 * PriceChart Komponente
 * 
 * Zeigt einen Candlestick-Chart mit Indikator-Overlays:
 * - Preis-Chart (Close-Preise)
 * - Bollinger Bands (Area)
 * - EMA/SMA Linien
 * - Volume Bars
 * 
 * Props:
 * - candles: Array von Candle-Objekten
 * - analysis: Analyse-Objekt mit Indikatoren
 * - interval: Zeitintervall (1h, 4h, 1d)
 */
export default function PriceChart({ candles, analysis, interval }) {
  if (!candles || candles.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
        Keine Chart-Daten verfügbar
      </div>
    );
  }

  // Vorbereite Daten für Chart
  const chartData = candles.map((candle, index) => {
    const time = new Date(candle.time);
    
    // Formatiere Zeit basierend auf Interval
    let timeLabel = '';
    if (interval === '1h') {
      timeLabel = format(time, 'dd.MM HH:mm');
    } else if (interval === '4h') {
      timeLabel = format(time, 'dd.MM HH:mm');
    } else {
      timeLabel = format(time, 'dd.MM.yyyy');
    }

    const data = {
      time: timeLabel,
      timestamp: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    };

    // Füge Indikatoren hinzu
    if (analysis?.indicators) {
      const indicators = analysis.indicators;
      
      // Moving Averages
      if (indicators.sma?.sma20 && indicators.sma.sma20[index] !== null) {
        data.sma20 = indicators.sma.sma20[index];
      }
      if (indicators.sma?.sma50 && indicators.sma.sma50[index] !== null) {
        data.sma50 = indicators.sma.sma50[index];
      }
      
      // EMA
      if (indicators.ema?.ema12 && indicators.ema.ema12[index] !== null) {
        data.ema12 = indicators.ema.ema12[index];
      }
      if (indicators.ema?.ema26 && indicators.ema.ema26[index] !== null) {
        data.ema26 = indicators.ema.ema26[index];
      }
      if (indicators.ema?.ema50 && indicators.ema.ema50[index] !== null) {
        data.ema50 = indicators.ema.ema50[index];
      }

      // Bollinger Bands
      if (indicators.bollinger?.upper && indicators.bollinger.upper[index] !== null) {
        data.bbUpper = indicators.bollinger.upper[index];
        data.bbMiddle = indicators.bollinger.middle[index];
        data.bbLower = indicators.bollinger.lower[index];
      }
    }

    return data;
  });

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-sm mb-2">{data.time}</p>
          <div className="space-y-1 text-sm">
            <div className="text-white">
              Close: <span className="font-semibold">${data.close?.toFixed(2)}</span>
            </div>
            <div className="text-gray-400">
              High: ${data.high?.toFixed(2)} | Low: ${data.low?.toFixed(2)}
            </div>
            <div className="text-gray-400">
              Open: ${data.open?.toFixed(2)} | Volume: {(data.volume / 1000000).toFixed(2)}M
            </div>
            {data.ema12 && (
              <div className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-700">
                EMA12: ${data.ema12.toFixed(2)}
              </div>
            )}
            {data.ema26 && (
              <div className="text-gray-500 text-xs">EMA26: ${data.ema26.toFixed(2)}</div>
            )}
            {data.sma20 && (
              <div className="text-gray-500 text-xs">SMA20: ${data.sma20.toFixed(2)}</div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 coin-symbol">Preis-Chart</h3>
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            domain={['auto', 'auto']}
            label={{ value: 'Preis (USD)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            stroke="#6B7280"
            tick={{ fill: '#6B7280', fontSize: 10 }}
            label={{ value: 'Volume', angle: 90, position: 'insideRight', fill: '#6B7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Bollinger Bands Area */}
          {chartData[0]?.bbUpper && (
            <>
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="bbUpper"
                fill="#374151"
                stroke="#6B7280"
                strokeWidth={1}
                opacity={0.2}
                name="Bollinger Upper"
              />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="bbMiddle"
                stroke="#6B7280"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="BB Middle"
              />
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="bbLower"
                fill="#374151"
                stroke="#6B7280"
                strokeWidth={1}
                opacity={0.2}
                name="Bollinger Lower"
              />
            </>
          )}

          {/* Price Line (Close) */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#F9FAFB"
            strokeWidth={2}
            dot={false}
            name="Close Price"
          />

          {/* EMA Lines */}
          {chartData[0]?.ema12 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema12"
              stroke="#60A5FA"
              strokeWidth={1.5}
              dot={false}
              name="EMA 12"
            />
          )}
          {chartData[0]?.ema26 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema26"
              stroke="#A78BFA"
              strokeWidth={1.5}
              dot={false}
              name="EMA 26"
            />
          )}
          {chartData[0]?.ema50 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ema50"
              stroke="#34D399"
              strokeWidth={1.5}
              dot={false}
              name="EMA 50"
            />
          )}

          {/* SMA Lines */}
          {chartData[0]?.sma20 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="sma20"
              stroke="#FBBF24"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="SMA 20"
            />
          )}
          {chartData[0]?.sma50 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="sma50"
              stroke="#FB7185"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="SMA 50"
            />
          )}

          {/* Volume Bars */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#374151"
            opacity={0.3}
            name="Volume"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

