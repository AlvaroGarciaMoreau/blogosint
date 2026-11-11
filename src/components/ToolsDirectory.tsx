import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Filter,
  Laptop,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { OsintEntry, PricingModel } from '../types/osint';

interface ToolsDirectoryProps {
  entries: OsintEntry[];
  onSelectEntry: (entry: OsintEntry) => void;
  onSelectTag: (tag: string) => void;
}

const PRICING_OPTIONS: Array<'ALL' | PricingModel> = [
  'ALL',
  'Gratuita',
  'Freemium',
  'De Pago',
];

export const ToolsDirectory: React.FC<ToolsDirectoryProps> = ({
  entries,
  onSelectEntry,
  onSelectTag,
}) => {
  const [pricingFilter, setPricingFilter] = useState<'ALL' | PricingModel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const toolEntries = useMemo(() => {
    return entries
      .filter((e) => e.dayCategory === 'MARTES_HERRAMIENTA')
      .filter((e) => {
        if (pricingFilter !== 'ALL' && e.metadata.pricingModel !== pricingFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            e.title.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q)) ||
            (e.metadata.osCompatibility ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [entries, pricingFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Martes · #Herramienta</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Caja de Herramientas OSINT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Directorio especializado de software, scripts y plataformas analizadas cada martes, con acceso directo a sus repositorios oficiales y filtrado por modelo de licencia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              Licencia:
            </span>
            {PRICING_OPTIONS.map((opt) => {
              const active = pricingFilter === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPricingFilter(opt)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt === 'ALL' ? 'Todas' : opt}
                </button>
              );
            })}
          </div>
        </div>

        <search className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="relative max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="tools-filter-input" className="visually-hidden">
              Filtrar herramientas por nombre, sistema operativo o etiqueta
            </label>
            <input
              id="tools-filter-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar herramienta por nombre, SO o etiqueta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-2 focus:outline-cyan-500"
            />
          </div>
        </search>
      </div>

      {/* Tools Grid */}
      {toolEntries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay herramientas registradas con el filtro seleccionado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {toolEntries.map((tool) => {
            const license = tool.metadata.pricingModel ?? 'Gratuita';
            const badgeStyle =
              license === 'Gratuita'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                : license === 'Freemium'
                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';

            return (
              <article
                key={tool.id}
                className="group bg-white dark:bg-slate-900/85 border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badgeStyle}`}
                    >
                      {license}
                    </span>

                    {tool.metadata.difficulty && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
                        {tool.metadata.difficulty}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                    <button
                      type="button"
                      onClick={() => onSelectEntry(tool)}
                      className="text-left cursor-pointer"
                    >
                      {tool.title}
                    </button>
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {tool.summary}
                  </p>

                  {tool.metadata.osCompatibility && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg">
                      <Laptop className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                      <span className="truncate">{tool.metadata.osCompatibility}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tool.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onSelectTag(t)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectEntry(tool)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Leer análisis ({tool.readingTimeMinutes}m)</span>
                  </button>

                  {tool.metadata.toolUrl && (
                    <a
                      href={tool.metadata.toolUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors"
                    >
                      <span>URL Oficial</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

