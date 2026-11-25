import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  RotateCcw,
  WifiOff,
} from 'lucide-react';
import {
  convertAmount,
  formatCheckTimestamp,
  formatConvertedAmount,
  formatExchangeRate,
  getCurrencyDisplayName,
  type RateStatusTone,
} from '../lib/rates';
import type { ConverterUserState, RatesCache } from '../lib/storage';

interface CalculatorPanelProps {
  state: ConverterUserState;
  availableCurrencies: string[];
  ratesCache: RatesCache;
  statusMessage: string;
  statusTone: RateStatusTone;
  isRefreshing: boolean;
  onAmountChange: (value: string) => void;
  onFromChange: (code: string) => void;
  onToChange: (code: string) => void;
  onSwap: () => void;
  onReset: () => void;
}

function parseAmountInput(raw: string): { valid: boolean; value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { valid: true, value: null, error: null };
  }
  if (!/^-?\d*\.?\d*$/.test(trimmed)) {
    return { valid: false, value: null, error: 'Enter a valid numeric amount.' };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) {
    return { valid: false, value: null, error: 'Enter a valid non-negative amount.' };
  }
  return { valid: true, value: num, error: null };
}

export function CalculatorPanel({
  state,
  availableCurrencies,
  ratesCache,
  statusMessage,
  statusTone,
  isRefreshing,
  onAmountChange,
  onFromChange,
  onToChange,
  onSwap,
  onReset,
}: CalculatorPanelProps) {
  const [swapRotation, setSwapRotation] = useState(0);
  const [copied, setCopied] = useState(false);

  const parsed = parseAmountInput(state.amount);

  let conversionResult: { converted: number; rate: number; inverseRate: number } | null = null;
  let conversionError: string | null = parsed.error;

  if (parsed.valid && parsed.value !== null) {
    try {
      conversionResult = convertAmount(parsed.value, state.from, state.to, ratesCache);
    } catch (err) {
      conversionError = err instanceof Error ? err.message : 'Unable to convert currencies.';
    }
  }

  const handleSwapClick = () => {
    setSwapRotation((prev) => prev + 180);
    onSwap();
  };

  const handleCopyResult = async () => {
    if (!conversionResult || parsed.value === null) return;
    const text = `${parsed.value.toLocaleString()} ${state.from} = ${formatConvertedAmount(
      conversionResult.converted
    )} ${state.to}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be restricted in some contexts; fail silently.
    }
  };

  const isDefaultState =
    state.amount.trim() === '1' && state.from === 'USD' && state.to === 'EUR';

  return (
    <section
      aria-label="Currency calculator"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 text-balance">
            Currency Converter
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Amount and currency selections are saved automatically across refreshes.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={isDefaultState}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 min-h-[40px]"
          title="Reset to 1 USD to EUR"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-5">
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          Amount
        </label>
        <div className="relative">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={state.amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            aria-invalid={conversionError ? 'true' : 'false'}
            className="w-full h-13 px-4 pr-16 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-xl sm:text-2xl font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-medium text-slate-400"
          >
            {state.from}
          </span>
        </div>
      </div>

      {/* Currency Selectors & Swap */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div>
          <label
            htmlFor="from-currency"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            From
          </label>
          <select
            id="from-currency"
            value={state.from}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
          >
            {availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {getCurrencyDisplayName(code)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwapClick}
            aria-label="Swap source and target currencies"
            title="Swap currencies"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ArrowLeftRight
              className="w-4 h-4 transition-transform duration-200 ease-out"
              style={{ transform: `rotate(${swapRotation}deg)` }}
              aria-hidden="true"
            />
          </button>
        </div>

        <div>
          <label
            htmlFor="to-currency"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            To
          </label>
          <select
            id="to-currency"
            value={state.to}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
          >
            {availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {getCurrencyDisplayName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hairline Divider */}
      <div className="my-6 border-t border-slate-200" />

      {/* Conversion Result / Error / Empty State */}
      <div aria-live="polite" className="min-h-[84px] flex flex-col justify-center">
        {conversionError ? (
          <div
            role="alert"
            className="flex items-center gap-2.5 text-sm font-medium text-red-600"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{conversionError}</span>
          </div>
        ) : conversionResult && parsed.value !== null ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500 font-mono tabular-nums">
                {parsed.value.toLocaleString()} {state.from} =
              </p>
              <p className="mt-1 font-mono tabular-nums text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
                {formatConvertedAmount(conversionResult.converted)}{' '}
                <span className="text-blue-600">{state.to}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                <span>
                  1 {state.from} = {formatExchangeRate(conversionResult.rate)} {state.to}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  1 {state.to} = {formatExchangeRate(conversionResult.inverseRate)} {state.from}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyResult}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center min-h-[40px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy Result</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Enter an amount above to see the converted value.
          </p>
        )}
      </div>

      {/* Hairline Divider */}
      <div className="my-6 border-t border-slate-200" />

      {/* Rate Metadata Line (Unboxed, Semantic Icon + Text) */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          {statusTone === 'live' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          ) : statusTone === 'cached' ? (
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          )}
          <span>{isRefreshing ? 'Checking latest rates…' : statusMessage}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          Rates updated: {ratesCache.lastUpdated ?? 'baseline'} (v{ratesCache.dataVersion})
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          Last checked: {formatCheckTimestamp(ratesCache.lastChecked)}
        </span>
      </div>
    </section>
  );
}
