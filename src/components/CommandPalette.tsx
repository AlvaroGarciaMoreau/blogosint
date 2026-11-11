import React, { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { ArrowRight, Clock, CornerDownLeft, Search, Tag, X } from 'lucide-react';
import { CATEGORY_CONFIG, OsintEntry } from '../types/osint';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  entries: OsintEntry[];
  onSelectEntry: (entry: OsintEntry) => void;
  onSelectTag: (tag: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  entries,
  onSelectEntry,
  onSelectTag,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: [
          { name: 'title', weight: 0.45 },
          { name: 'tags', weight: 0.25 },
          { name: 'summary', weight: 0.2 },
          { name: 'content', weight: 0.1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [entries]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      return entries.slice(0, 8);
    }
    return fuse.search(query.trim()).map((r) => r.item).slice(0, 10);
  }, [query, entries, fuse]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Fallback for browsers without native dialog closedby="any" support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    let removeFallback: (() => void) | undefined;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
      removeFallback = () => dialog.removeEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (removeFallback) removeFallback();
    };
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectEntry(results[selectedIndex]);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby="command-palette-title"
      onKeyDown={handleKeyDown}
      className="w-full max-w-2xl mx-auto mt-[10dvh] p-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
    >
      <h2 id="command-palette-title" className="visually-hidden">
        Buscador instantáneo de cápsulas OSINT
      </h2>

      <search>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-cyan-500 shrink-0" aria-hidden="true" />
          <label htmlFor="cmd-search-input" className="visually-hidden">
            Buscar por título, herramienta, dork o etiqueta
          </label>
          <input
            ref={inputRef}
            id="cmd-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar técnica, herramienta (ej. Maltego, Shodan), dork o #etiqueta..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar buscador"
            className="px-2 py-1 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Esc
          </button>
        </div>
      </search>

      <div className="max-h-[60dvh] overflow-y-auto p-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
        {results.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No se encontraron cápsulas para <strong className="text-slate-800 dark:text-slate-200">"{query}"</strong>.
          </div>
        ) : (
          <ul role="list" className="space-y-1">
            {results.map((item, idx) => {
              const cat = CATEGORY_CONFIG[item.dayCategory];
              const isSelected = idx === selectedIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectEntry(item);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 dark:bg-cyan-500/15 ring-1 ring-cyan-500/30'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${cat.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`} aria-hidden="true" />
                          {cat.dayName} · {cat.hashtag}
                        </span>
                        {item.metadata.pricingModel && (
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.metadata.pricingModel}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {item.readingTimeMinutes}m
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {item.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTag(t);
                              onClose();
                            }}
                            className="inline-flex items-center gap-0.5 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 self-center text-slate-400">
                      {isSelected ? (
                        <CornerDownLeft className="w-4 h-4 text-cyan-500" aria-hidden="true" />
                      ) : (
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
              ↑↓
            </kbd>{' '}
            Navegar
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
              Enter
            </kbd>{' '}
            Abrir cápsula
          </span>
        </div>
        <span>Fuzzy Search con Fuse.js</span>
      </div>
    </dialog>
  );
};

