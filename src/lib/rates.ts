import {
  RATES_CACHE_SCHEMA,
  type RateHistoryCache,
  type RatesCache,
  readRateHistoryCache,
  readRatesCache,
  writeRateHistoryCache,
  writeRatesCache,
} from './storage';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 156.5,
  AUD: 1.55,
  CAD: 1.36,
  CHF: 0.92,
  CNY: 7.23,
  INR: 83.2,
  BRL: 5.25,
  ISK: 128.5,
};

export const CURRENCY_NAMES: Record<string, string> = {
  AED: 'UAE Dirham',
  ARS: 'Argentine Peso',
  AUD: 'Australian Dollar',
  BGN: 'Bulgarian Lev',
  BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc',
  CLP: 'Chilean Peso',
  CNY: 'Chinese Renminbi',
  COP: 'Colombian Peso',
  CZK: 'Czech Koruna',
  DKK: 'Danish Krone',
  EGP: 'Egyptian Pound',
  EUR: 'Euro',
  GBP: 'British Pound',
  HKD: 'Hong Kong Dollar',
  HUF: 'Hungarian Forint',
  IDR: 'Indonesian Rupiah',
  ILS: 'Israeli Shekel',
  INR: 'Indian Rupee',
  ISK: 'Icelandic Króna',
  JPY: 'Japanese Yen',
  KRW: 'South Korean Won',
  MXN: 'Mexican Peso',
  MYR: 'Malaysian Ringgit',
  NGN: 'Nigerian Naira',
  NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',
  PHP: 'Philippine Peso',
  PKR: 'Pakistani Rupee',
  PLN: 'Polish Złoty',
  RON: 'Romanian Leu',
  SAR: 'Saudi Riyal',
  SEK: 'Swedish Krona',
  SGD: 'Singapore Dollar',
  THB: 'Thai Baht',
  TRY: 'Turkish Lira',
  TWD: 'New Taiwan Dollar',
  UAH: 'Ukrainian Hryvnia',
  USD: 'US Dollar',
  VND: 'Vietnamese Dong',
  ZAR: 'South African Rand',
};

export type RateStatusTone = 'live' | 'cached' | 'fallback';

export interface RatesLoadResult {
  cache: RatesCache;
  statusMessage: string;
  tone: RateStatusTone;
}

export interface HistoricalRatePoint {
  date: string;
  label: string;
  rate: number;
}

export function getCurrencyDisplayName(code: string): string {
  return CURRENCY_NAMES[code] ? `${code} — ${CURRENCY_NAMES[code]}` : code;
}

export function buildSortedCurrencyList(cache: RatesCache | null): string[] {
  if (!cache || !cache.rates) {
    return Object.keys(FALLBACK_RATES).sort();
  }
  const codes = new Set<string>(Object.keys(cache.rates));
  if (cache.base) {
    codes.add(cache.base);
  }
  return Array.from(codes).sort();
}

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  cache: RatesCache
): { converted: number; rate: number; inverseRate: number } {
  const rates: Record<string, number> = { ...cache.rates, [cache.base]: 1.0 };

  if (!(from in rates) || !(to in rates)) {
    throw new Error(`Exchange rate unavailable for ${!(from in rates) ? from : to}`);
  }

  if (from === to) {
    return { converted: amount, rate: 1, inverseRate: 1 };
  }

  const rate = rates[to] / rates[from];
  const inverseRate = rates[from] / rates[to];
  const converted = amount * rate;

  return { converted, rate, inverseRate };
}

export function formatConvertedAmount(value: number): string {
  const maxFrac = value > 0 && value < 1 ? 4 : 2;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

export function formatExchangeRate(rate: number): string {
  const maxFrac = rate > 0 && rate < 0.01 ? 6 : 4;
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  });
}

export function formatCheckTimestamp(ms: number | null): string {
  if (!ms) return 'never';
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(ms);
  }
}

async function fetchLatestRates(): Promise<{
  base: string;
  rates: Record<string, number>;
  date: string;
}> {
  const resp = await fetch('https://open.er-api.com/v6/latest/EUR', {
    cache: 'no-cache',
  });
  if (!resp.ok) {
    throw new Error(`ExchangeRate-API returned ${resp.status}`);
  }
  const data = (await resp.json()) as {
    result?: string;
    rates?: Record<string, number>;
    base_code?: string;
    time_last_update_unix?: number;
  };
  if (
    data.result !== 'success' ||
    !data.rates ||
    !data.base_code ||
    typeof data.time_last_update_unix !== 'number'
  ) {
    throw new Error('Invalid ExchangeRate-API payload');
  }
  return {
    base: data.base_code,
    rates: data.rates,
    date: new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10),
  };
}

export function getInitialRatesSnapshot(): RatesLoadResult {
  const existing = readRatesCache();
  if (existing && existing.rates) {
    const isFallback = existing.note === 'fallback' || existing.dataVersion === 0;
    return {
      cache: existing,
      statusMessage: isFallback ? 'Loaded fallback rates' : 'Loaded cached rates',
      tone: isFallback ? 'fallback' : 'cached',
    };
  }
  return {
    cache: {
      schema: RATES_CACHE_SCHEMA,
      dataVersion: 0,
      base: 'USD',
      rates: FALLBACK_RATES,
      lastUpdated: null,
      lastChecked: null,
      note: 'fallback',
    },
    statusMessage: 'Using built-in baseline rates',
    tone: 'fallback',
  };
}

export async function ensureExchangeRates(options?: {
  force?: boolean;
}): Promise<RatesLoadResult> {
  const force = Boolean(options?.force);
  const now = Date.now();
  const cache = readRatesCache();

  if (
    !force &&
    cache &&
    cache.lastChecked &&
    now - cache.lastChecked < MS_PER_DAY &&
    cache.note !== 'fallback'
  ) {
    return {
      cache,
      statusMessage: 'Using fresh 24h cache',
      tone: 'live',
    };
  }

  try {
    const fetched = await fetchLatestRates();
    if (cache && cache.lastUpdated && fetched.date === cache.lastUpdated && cache.note !== 'fallback') {
      const updatedCache: RatesCache = {
        ...cache,
        lastChecked: now,
      };
      writeRatesCache(updatedCache);
      return {
        cache: updatedCache,
        statusMessage: 'Checked — rates up to date',
        tone: 'live',
      };
    }

    const prevVersion = cache && typeof cache.dataVersion === 'number' ? cache.dataVersion : 0;
    const newCache: RatesCache = {
      schema: RATES_CACHE_SCHEMA,
      dataVersion: prevVersion + 1,
      base: fetched.base,
      rates: fetched.rates,
      lastUpdated: fetched.date,
      lastChecked: now,
    };
    writeRatesCache(newCache);
    return {
      cache: newCache,
      statusMessage: 'Fetched latest live rates',
      tone: 'live',
    };
  } catch {
    if (cache && cache.note !== 'fallback') {
      const updatedCache: RatesCache = {
        ...cache,
        lastChecked: now,
      };
      writeRatesCache(updatedCache);
      return {
        cache: updatedCache,
        statusMessage: 'Network unavailable — using cached rates',
        tone: 'cached',
      };
    }

    const fallbackCache: RatesCache = {
      schema: RATES_CACHE_SCHEMA,
      dataVersion: 0,
      base: 'USD',
      rates: FALLBACK_RATES,
      lastUpdated: null,
      lastChecked: now,
      note: 'fallback',
    };
    writeRatesCache(fallbackCache);
    return {
      cache: fallbackCache,
      statusMessage: 'Offline — using fallback rates',
      tone: 'fallback',
    };
  }
}

function normalizeRatesToEur(cache: RatesCache): Record<string, number> | null {
  if (!cache.rates || typeof cache.rates !== 'object') return null;
  if (cache.base === 'EUR') {
    return { ...cache.rates, EUR: 1.0 };
  }
  const eurPerBase = cache.rates['EUR'];
  if (typeof eurPerBase !== 'number' || !Number.isFinite(eurPerBase) || eurPerBase <= 0) {
    return null;
  }
  const normalized: Record<string, number> = { EUR: 1.0, [cache.base]: 1 / eurPerBase };
  for (const [code, val] of Object.entries(cache.rates)) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      normalized[code] = val / eurPerBase;
    }
  }
  return normalized;
}

export function upsertRatesIntoHistory(
  history: RateHistoryCache,
  ratesCache: RatesCache
): RateHistoryCache {
  if (ratesCache.note === 'fallback' || !ratesCache.lastUpdated) {
    return history;
  }
  const normalized = normalizeRatesToEur(ratesCache);
  if (!normalized) {
    return history;
  }
  const existingDay = history.days[ratesCache.lastUpdated] ?? {};
  return {
    ...history,
    days: {
      ...history.days,
      [ratesCache.lastUpdated]: {
        ...existingDay,
        ...normalized,
      },
    },
  };
}

export function getInitialHistorySnapshot(initialRates?: RatesCache): RateHistoryCache {
  let history = readRateHistoryCache();
  if (initialRates) {
    const updated = upsertRatesIntoHistory(history, initialRates);
    if (updated !== history) {
      history = updated;
      writeRateHistoryCache(history);
    }
  }
  return history;
}

function formatDateIsoUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchHistoricalRatesWindow(): Promise<Record<string, Record<string, number>>> {
  const now = Date.now();
  const endDate = formatDateIsoUtc(now);
  const startDate = formatDateIsoUtc(now - 14 * MS_PER_DAY);
  const resp = await fetch(`https://api.frankfurter.app/${startDate}..${endDate}`, {
    cache: 'no-cache',
  });
  if (!resp.ok) {
    throw new Error(`Frankfurter history API returned ${resp.status}`);
  }
  const data = (await resp.json()) as {
    base?: string;
    rates?: Record<string, Record<string, number>>;
  };
  if (!data.rates || typeof data.rates !== 'object') {
    throw new Error('Invalid Frankfurter history payload');
  }
  return data.rates;
}

export async function ensureHistoricalRates(options?: {
  force?: boolean;
  latestRatesCache?: RatesCache;
}): Promise<RateHistoryCache> {
  const force = Boolean(options?.force);
  const now = Date.now();
  let history = readRateHistoryCache();

  if (options?.latestRatesCache) {
    history = upsertRatesIntoHistory(history, options.latestRatesCache);
  }

  const cachedDayCount = Object.keys(history.days).length;
  const isFresh =
    !force &&
    cachedDayCount >= 7 &&
    history.lastChecked !== null &&
    now - history.lastChecked < MS_PER_DAY;

  if (isFresh) {
    writeRateHistoryCache(history);
    return history;
  }

  try {
    const fetchedDays = await fetchHistoricalRatesWindow();
    const mergedDays: Record<string, Record<string, number>> = { ...history.days };

    for (const [date, dayRates] of Object.entries(fetchedDays)) {
      if (dayRates && typeof dayRates === 'object') {
        mergedDays[date] = {
          ...(mergedDays[date] ?? {}),
          ...dayRates,
          EUR: 1.0,
        };
      }
    }

    const updatedHistory: RateHistoryCache = {
      ...history,
      lastChecked: now,
      days: mergedDays,
    };
    writeRateHistoryCache(updatedHistory);
    return updatedHistory;
  } catch {
    if (options?.latestRatesCache) {
      writeRateHistoryCache(history);
    }
    return history;
  }
}

function formatShortAxisDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return isoDate;
  }
}

export function build7DayRateSeries(
  history: RateHistoryCache,
  from: string,
  to: string
): HistoricalRatePoint[] {
  const sortedDates = Object.keys(history.days).sort();
  const points: HistoricalRatePoint[] = [];

  for (const date of sortedDates) {
    const rawDayRates = history.days[date];
    if (!rawDayRates) continue;

    if (from === to) {
      points.push({
        date,
        label: formatShortAxisDate(date),
        rate: 1,
      });
      continue;
    }

    const fromRate = from === 'EUR' ? 1.0 : rawDayRates[from];
    const toRate = to === 'EUR' ? 1.0 : rawDayRates[to];

    if (
      typeof fromRate === 'number' &&
      Number.isFinite(fromRate) &&
      fromRate > 0 &&
      typeof toRate === 'number' &&
      Number.isFinite(toRate) &&
      toRate > 0
    ) {
      points.push({
        date,
        label: formatShortAxisDate(date),
        rate: toRate / fromRate,
      });
    }
  }

  return points.slice(-7);
}
