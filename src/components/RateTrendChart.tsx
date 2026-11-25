import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  build7DayRateSeries,
  formatExchangeRate,
  type HistoricalRatePoint,
} from '../lib/rates';
import type { RateHistoryCache } from '../lib/storage';

interface RateTrendChartProps {
  fromCurrency: string;
  toCurrency: string;
  historyCache: RateHistoryCache;
  isLoading: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HistoricalRatePoint }>;
  fromCurrency: string;
  toCurrency: string;
}

function ChartTooltip({
  active,
  payload,
  fromCurrency,
  toCurrency,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="text-slate-500 font-mono">{point.date}</p>
      <p className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900">
        1 {fromCurrency} = {formatExchangeRate(point.rate)} {toCurrency}
      </p>
    </div>
  );
}

export function RateTrendChart({
  fromCurrency,
  toCurrency,
  historyCache,
  isLoading,
}: RateTrendChartProps) {
  const series = useMemo(
    () => build7DayRateSeries(historyCache, fromCurrency, toCurrency),
    [historyCache, fromCurrency, toCurrency]
  );

  const stats = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0].rate;
    const last = series[series.length - 1].rate;
    const min = Math.min(...series.map((p) => p.rate));
    const max = Math.max(...series.map((p) => p.rate));
    const pctChange = first > 0 ? ((last - first) / first) * 100 : 0;

    const span = max - min;
    const pad = span > 0 ? span * 0.2 : Math.max(max * 0.005, 0.0001);
    const domainMin = Math.max(0, min - pad);
    const domainMax = max + pad;

    return { first, last, min, max, pctChange, domainMin, domainMax };
  }, [series]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            7-Day Rate Trend
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
            1 {fromCurrency} to {toCurrency} · {series.length} cached{' '}
            {series.length === 1 ? 'day' : 'days'}
          </p>
        </div>

        {stats ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums">
            <span className="text-slate-500">
              Low {formatExchangeRate(stats.min)} · High{' '}
              {formatExchangeRate(stats.max)}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                stats.pctChange > 0.005
                  ? 'text-emerald-600'
                  : stats.pctChange < -0.005
                    ? 'text-red-600'
                    : 'text-slate-600'
              }`}
            >
              {stats.pctChange > 0.005 ? (
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : stats.pctChange < -0.005 ? (
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {stats.pctChange > 0 ? '+' : ''}
                {stats.pctChange.toFixed(2)}%
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {series.length >= 2 && stats ? (
        <div className="w-full h-[176px] min-w-0">
          <ResponsiveContainer width="100%" height={176}>
            <LineChart
              data={series}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E2E8F0"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tick={{
                  fontSize: 11,
                  fill: '#64748B',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <YAxis
                domain={[stats.domainMin, stats.domainMax]}
                width={64}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatExchangeRate(Number(value))}
                tick={{
                  fontSize: 11,
                  fill: '#64748B',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Tooltip
                cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                content={
                  <ChartTooltip
                    fromCurrency={fromCurrency}
                    toCurrency={toCurrency}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
                activeDot={{
                  r: 5,
                  fill: '#2563EB',
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[112px] flex items-center justify-center text-center px-4 bg-slate-50/70 rounded-lg">
          <p className="text-xs text-slate-500">
            {isLoading
              ? 'Loading cached 7-day historical rates…'
              : series.length === 1
                ? `1 cached data point available for ${fromCurrency}/${toCurrency} (${series[0].date}). Additional points accumulate as daily rates are cached.`
                : `No cached multi-day history is available yet for ${fromCurrency}/${toCurrency}.`}
          </p>
        </div>
      )}
    </div>
  );
}
