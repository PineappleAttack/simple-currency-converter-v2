import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { CURRENCY_NAMES } from '../lib/rates';

const POPULAR_CODES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY'];

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  currencies: string[];
  onChange: (code: string) => void;
}

export function CurrencySelect({
  id,
  label,
  value,
  currencies,
  onChange,
}: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const { popularList, otherList, flatOptions } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      const popularSet = new Set(
        POPULAR_CODES.filter((code) => currencies.includes(code))
      );
      const popular = POPULAR_CODES.filter((code) => popularSet.has(code));
      const others = currencies.filter((code) => !popularSet.has(code));
      return {
        popularList: popular,
        otherList: others,
        flatOptions: [...popular, ...others],
      };
    }

    const matched = currencies.filter((code) => {
      const name = (CURRENCY_NAMES[code] ?? '').toLowerCase();
      return code.toLowerCase().includes(needle) || name.includes(needle);
    });

    matched.sort((a, b) => {
      const aCodeMatch = a.toLowerCase().startsWith(needle) ? 0 : 1;
      const bCodeMatch = b.toLowerCase().startsWith(needle) ? 0 : 1;
      if (aCodeMatch !== bCodeMatch) return aCodeMatch - bCodeMatch;
      return a.localeCompare(b);
    });

    return {
      popularList: [] as string[],
      otherList: matched,
      flatOptions: matched,
    };
  }, [currencies, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIdx = flatOptions.indexOf(value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const selectCurrency = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.target instanceof HTMLButtonElement &&
      event.target !== triggerRef.current
    ) {
      return;
    }

    if (!isOpen) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setQuery('');
      triggerRef.current?.focus();
      return;
    }

    if (flatOptions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatOptions.length) % flatOptions.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(flatOptions.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = flatOptions[activeIndex];
      if (chosen) selectCurrency(chosen);
    }
  };

  const selectedName = CURRENCY_NAMES[value] ?? value;

  const renderOption = (code: string, index: number) => {
    const isSelected = code === value;
    const isActive = index === activeIndex;
    const name = CURRENCY_NAMES[code];

    return (
      <button
        key={code}
        type="button"
        role="option"
        aria-selected={isSelected}
        data-option-index={index}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectCurrency(code)}
        className={`w-full min-h-[40px] px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-900'
            : isSelected
              ? 'bg-slate-50 text-slate-900'
              : 'text-slate-900 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className={`font-mono text-xs font-semibold w-9 shrink-0 ${
              isSelected || isActive ? 'text-blue-700' : 'text-slate-800'
            }`}
          >
            {code}
          </span>
          <span className="text-sm text-slate-600 truncate">
            {name ?? code}
          </span>
        </span>
        {isSelected && (
          <Check className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 mb-2"
      >
        {label}
      </label>

      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white flex items-center justify-between gap-2 text-left hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-900 shrink-0">
            {value}
          </span>
          <span className="text-sm text-slate-500 truncate">
            {selectedName !== value ? selectedName : ''}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-slate-600' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} currency`}
          className="absolute left-0 right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code or name…"
                aria-label={`Search ${label} currency`}
                className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
            {flatOptions.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs text-slate-500">
                  No currencies match “{query.trim()}”.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Clear search
                </button>
              </div>
            ) : query.trim() === '' ? (
              <>
                {popularList.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-slate-400">
                      Popular
                    </div>
                    {popularList.map((code, idx) => renderOption(code, idx))}
                  </div>
                )}
                {otherList.length > 0 && (
                  <div className={popularList.length > 0 ? 'mt-1 pt-1 border-t border-slate-100' : ''}>
                    <div className="px-3 py-1.5 text-xs font-medium text-slate-400">
                      All currencies
                    </div>
                    {otherList.map((code, idx) =>
                      renderOption(code, popularList.length + idx)
                    )}
                  </div>
                )}
              </>
            ) : (
              flatOptions.map((code, idx) => renderOption(code, idx))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
