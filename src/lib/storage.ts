export interface ConverterUserState {
  amount: string;
  from: string;
  to: string;
}

export interface RatesCache {
  schema: string;
  dataVersion: number;
  base: string;
  rates: Record<string, number>;
  lastUpdated: string | null;
  lastChecked: number | null;
  note?: string | null;
}

export interface RateHistoryCache {
  schema: string;
  lastChecked: number | null;
  days: Record<string, Record<string, number>>;
}

export const CONVERTER_STATE_KEY = 'currency_converter_state_v1';
export const RATES_STORAGE_KEY = 'frankfurter_rates_v2';
export const RATES_CACHE_SCHEMA = 'frankfurter_cache_v2';
export const HISTORY_STORAGE_KEY = 'currency_rate_history_v1';
export const HISTORY_CACHE_SCHEMA = 'rate_history_v1';

export const DEFAULT_CONVERTER_STATE: ConverterUserState = {
  amount: '1',
  from: 'USD',
  to: 'EUR',
};

function isValidCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

export function readConverterState(): ConverterUserState {
  try {
    const raw = window.localStorage.getItem(CONVERTER_STATE_KEY);
    if (!raw) return DEFAULT_CONVERTER_STATE;
    const parsed = JSON.parse(raw) as Partial<ConverterUserState> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONVERTER_STATE;

    const amount =
      typeof parsed.amount === 'string'
        ? parsed.amount
        : typeof parsed.amount === 'number' && Number.isFinite(parsed.amount)
          ? String(parsed.amount)
          : DEFAULT_CONVERTER_STATE.amount;

    const from = isValidCurrencyCode(parsed.from)
      ? parsed.from
      : DEFAULT_CONVERTER_STATE.from;

    const to = isValidCurrencyCode(parsed.to)
      ? parsed.to
      : DEFAULT_CONVERTER_STATE.to;

    return { amount, from, to };
  } catch {
    return DEFAULT_CONVERTER_STATE;
  }
}

export function writeConverterState(state: ConverterUserState): void {
  try {
    window.localStorage.setItem(CONVERTER_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing write failures cleanly.
  }
}

export function readRatesCache(): RatesCache | null {
  try {
    const raw = window.localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    if (!parsed.schema) {
      const ratesCandidate =
        parsed.rates && typeof parsed.rates === 'object'
          ? (parsed.rates as Record<string, number>)
          : (parsed as unknown as Record<string, number>);

      return {
        schema: RATES_CACHE_SCHEMA,
        dataVersion: typeof parsed.dataVersion === 'number' ? parsed.dataVersion : 1,
        base: typeof parsed.base === 'string' ? parsed.base : 'EUR',
        rates: ratesCandidate,
        lastUpdated: typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : null,
        lastChecked: typeof parsed.lastChecked === 'number' ? parsed.lastChecked : null,
        note: typeof parsed.note === 'string' ? parsed.note : null,
      };
    }

    if (!parsed.rates || typeof parsed.rates !== 'object' || typeof parsed.base !== 'string') {
      return null;
    }

    return parsed as unknown as RatesCache;
  } catch {
    return null;
  }
}

export function writeRatesCache(cache: RatesCache): void {
  try {
    window.localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota or private browsing write failures cleanly.
  }
}

export function readRateHistoryCache(): RateHistoryCache {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return { schema: HISTORY_CACHE_SCHEMA, lastChecked: null, days: {} };
    }
    const parsed = JSON.parse(raw) as Partial<RateHistoryCache> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.days || typeof parsed.days !== 'object') {
      return { schema: HISTORY_CACHE_SCHEMA, lastChecked: null, days: {} };
    }
    return {
      schema: HISTORY_CACHE_SCHEMA,
      lastChecked: typeof parsed.lastChecked === 'number' ? parsed.lastChecked : null,
      days: parsed.days,
    };
  } catch {
    return { schema: HISTORY_CACHE_SCHEMA, lastChecked: null, days: {} };
  }
}

export function writeRateHistoryCache(cache: RateHistoryCache): void {
  try {
    const sortedDates = Object.keys(cache.days).sort();
    const recentDates = sortedDates.slice(-30);
    const trimmedDays: Record<string, Record<string, number>> = {};
    for (const date of recentDates) {
      trimmedDays[date] = cache.days[date];
    }
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        schema: HISTORY_CACHE_SCHEMA,
        lastChecked: cache.lastChecked,
        days: trimmedDays,
      })
    );
  } catch {
    // Ignore storage quota or private browsing write failures cleanly.
  }
}
