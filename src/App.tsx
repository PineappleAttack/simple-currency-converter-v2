import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CalculatorPanel } from './components/CalculatorPanel';
import {
  buildSortedCurrencyList,
  ensureExchangeRates,
  getInitialRatesSnapshot,
  type RatesLoadResult,
} from './lib/rates';
import {
  type ConverterUserState,
  DEFAULT_CONVERTER_STATE,
  readConverterState,
  writeConverterState,
} from './lib/storage';

export default function App() {
  const [converterState, setConverterState] = useState<ConverterUserState>(() =>
    readConverterState()
  );
  const [ratesSnapshot, setRatesSnapshot] = useState<RatesLoadResult>(() =>
    getInitialRatesSnapshot()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const availableCurrencies = useMemo(
    () => buildSortedCurrencyList(ratesSnapshot.cache),
    [ratesSnapshot.cache]
  );

  const updateConverterState = useCallback(
    (updater: (prev: ConverterUserState) => ConverterUserState) => {
      setConverterState((prev) => {
        const next = updater(prev);
        writeConverterState(next);
        return next;
      });
    },
    []
  );

  const syncRates = useCallback(async (force: boolean) => {
    setIsRefreshing(true);
    try {
      const result = await ensureExchangeRates({ force });
      setRatesSnapshot(result);

      const list = buildSortedCurrencyList(result.cache);
      setConverterState((prev) => {
        const nextFrom = list.includes(prev.from)
          ? prev.from
          : list.includes('USD')
            ? 'USD'
            : list[0];
        const nextTo = list.includes(prev.to)
          ? prev.to
          : list.includes('EUR')
            ? 'EUR'
            : list[1] || list[0];

        if (nextFrom === prev.from && nextTo === prev.to) {
          return prev;
        }
        const reconciled = { ...prev, from: nextFrom, to: nextTo };
        writeConverterState(reconciled);
        return reconciled;
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void syncRates(false);
  }, [syncRates]);

  const handleAmountChange = useCallback(
    (value: string) => {
      updateConverterState((prev) => ({ ...prev, amount: value }));
    },
    [updateConverterState]
  );

  const handleFromChange = useCallback(
    (code: string) => {
      updateConverterState((prev) => ({ ...prev, from: code }));
    },
    [updateConverterState]
  );

  const handleToChange = useCallback(
    (code: string) => {
      updateConverterState((prev) => ({ ...prev, to: code }));
    },
    [updateConverterState]
  );

  const handleSwap = useCallback(() => {
    updateConverterState((prev) => ({
      ...prev,
      from: prev.to,
      to: prev.from,
    }));
  }, [updateConverterState]);

  const handleReset = useCallback(() => {
    updateConverterState(() => DEFAULT_CONVERTER_STATE);
  }, [updateConverterState]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="./"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded"
          >
            Simple Currency Calculator
          </a>

          <button
            type="button"
            onClick={() => void syncRates(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh Rates'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <CalculatorPanel
          state={converterState}
          availableCurrencies={availableCurrencies}
          ratesCache={ratesSnapshot.cache}
          statusMessage={ratesSnapshot.statusMessage}
          statusTone={ratesSnapshot.tone}
          isRefreshing={isRefreshing}
          onAmountChange={handleAmountChange}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onSwap={handleSwap}
          onReset={handleReset}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 py-5 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center text-xs text-slate-500">
          Rates via ExchangeRate-API (open.er-api.com) with 24-hour local cache and offline fallback · Preferences saved locally in your browser
        </div>
      </footer>
    </div>
  );
}
