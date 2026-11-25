import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  CURRENCY_NAMES,
  convertAmount,
  formatConvertedAmount,
} from '../lib/rates';
import type { RatesCache } from '../lib/storage';

interface CrossRatesPanelProps {
  amountRaw: string;
  fromCurrency: string;
  toCurrency: string;
  availableCurrencies: string[];
  ratesCache: RatesCache;
  onSelectToCurrency: (code: string) => void;
}

export function CrossRatesPanel({
  amountRaw,
  fromCurrency,
  toCurrency,
  availableCurrencies,
  ratesCache,
  onSelectToCurrency,
}: CrossRatesPanelProps) {
  const [query, setQuery] = useState('');

  const parsedAmount = useMemo(() => {
    const trimmed = amountRaw.trim();
    if (trimmed === '' || !/^-?\d*\.?\d*$/.test(trimmed)) return 1;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : 1;
  }, [amountRaw]);

  const filteredCurrencies = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = availableCurrencies.filter((code) => code !== fromCurrency);
    if (!needle) return list;
    return list.filter((code) => {
      const name = (CURRENCY_NAMES[code] ?? '').toLowerCase();
      return code.toLowerCase().includes(needle) || name.includes(needle);
    });
  }, [availableCurrencies, fromCurrency, query]);

  return (
    <aside
      aria-label="Cross-rate reference table"
      className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Cross-Rate Reference
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
          {parsedAmount.toLocaleString()} {fromCurrency} across {availableCurrencies.length - 1} currencies
        </p>
      </div>

      {/* Live Search Input */}
      <div className="relative mb-4">
        <Search
          className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by code or currency name…"
          aria-label="Filter currencies"
          className="w-full h-10 pl-9 pr-9 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear currency filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Reference List */}
      {filteredCurrencies.length === 0 ? (
        <div className="py-12 px-4 text-center border-t border-slate-100">
          <p className="text-sm text-slate-600">
            No currencies match “{query.trim()}”.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-3 px-4 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[40px] focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-200 max-h-[388px] overflow-y-auto divide-y divide-slate-100">
          {filteredCurrencies.map((code) => {
            const isSelected = code === toCurrency;
            let convertedDisplay = '—';
            try {
              const { converted } = convertAmount(
                parsedAmount,
                fromCurrency,
                code,
                ratesCache
              );
              convertedDisplay = formatConvertedAmount(converted);
            } catch {
              convertedDisplay = '—';
            }

            return (
              <button
                key={code}
                type="button"
                onClick={() => onSelectToCurrency(code)}
                aria-pressed={isSelected}
                className={`w-full min-h-[42px] px-2.5 py-2 flex items-center justify-between gap-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
                  isSelected
                    ? 'bg-blue-50/80 text-blue-900'
                    : 'hover:bg-slate-50 text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`font-mono text-xs font-semibold w-9 shrink-0 ${
                      isSelected ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {code}
                  </span>
                  <span className="text-sm text-slate-600 truncate">
                    {CURRENCY_NAMES[code] ?? code}
                  </span>
                </span>

                <span className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <span className="text-xs font-medium text-blue-600">
                      Target
                    </span>
                  )}
                  <span
                    className={`font-mono tabular-nums text-sm font-medium ${
                      isSelected ? 'text-blue-700' : 'text-slate-900'
                    }`}
                  >
                    {convertedDisplay}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
