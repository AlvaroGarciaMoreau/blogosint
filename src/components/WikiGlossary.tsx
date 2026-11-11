import React, { useMemo, useState } from 'react';
import { ArrowRight, BookMarked, Compass, ShieldAlert } from 'lucide-react';
import { DifficultyLevel, OsintEntry } from '../types/osint';

interface WikiGlossaryProps {
  entries: OsintEntry[];
  onSelectEntry: (entry: OsintEntry) => void;
  onSelectTag: (tag: string) => void;
}

const DIFFICULTY_FILTERS: Array<'ALL' | DifficultyLevel> = [
  'ALL',
  'Básico',
  'Intermedio',
  'Avanzado',
];

export const WikiGlossary: React.FC<WikiGlossaryProps> = ({
  entries,
  onSelectEntry,
  onSelectTag,
}) => {
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | DifficultyLevel>('ALL');

  const techniqueEntries = useMemo(() => {
    return entries
      .filter((e) => e.dayCategory === 'LUNES_TECNICA')
      .filter((e) => {
        if (difficultyFilter !== 'ALL' && e.metadata.difficulty !== difficultyFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }, [entries, difficultyFilter]);

  const groupedByLetter = useMemo(() => {
    const groups = new Map<string, OsintEntry[]>();
    for (const item of techniqueEntries) {
      const firstChar = item.title
        .trim()
        .charAt(0)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups.has(letter)) {
        groups.set(letter, []);
      }
      groups.get(letter)!.push(item);
    }
    return groups;
  }, [techniqueEntries]);

  const availableLetters = useMemo(
    () => Array.from(groupedByLetter.keys()).sort(),
    [groupedByLetter]
  );

  const visibleGroups = useMemo(() => {
    if (selectedLetter === 'ALL') {
      return Array.from(groupedByLetter.entries());
    }
    const items = groupedByLetter.get(selectedLetter);
    return items ? [[selectedLetter, items] as [string, OsintEntry[]]] : [];
  }, [groupedByLetter, selectedLetter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lunes · #Técnica</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Glosario y Wiki de Técnicas OSINT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Índice alfabético de fundamentos, metodologías de investigación y conceptos analíticos recopilados cada lunes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Dificultad:
            </span>
            {DIFFICULTY_FILTERS.map((lvl) => {
              const active = difficultyFilter === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficultyFilter(lvl)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {lvl === 'ALL' ? 'Todos los niveles' : lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alphabetical Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedLetter('ALL')}
            aria-pressed={selectedLetter === 'ALL'}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
              selectedLetter === 'ALL'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            A–Z ({techniqueEntries.length})
          </button>
          {availableLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setSelectedLetter(letter)}
              aria-pressed={selectedLetter === letter}
              className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                selectedLetter === letter
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-500/15 hover:text-sky-600'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Entries */}
      {visibleGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No se encontraron técnicas de los lunes con el filtro actual.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(([letter, items]) => (
            <section
              key={letter}
              aria-labelledby={`wiki-letter-${letter}`}
              className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-xs"
            >
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                <span
                  id={`wiki-letter-${letter}`}
                  className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-mono text-lg font-extrabold flex items-center justify-center"
                >
                  {letter}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {items.length} {items.length === 1 ? 'técnica documentada' : 'técnicas documentadas'}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                          <button
                            type="button"
                            onClick={() => onSelectEntry(item)}
                            className="text-left cursor-pointer"
                          >
                            {item.title}
                          </button>
                        </h3>
                        {item.metadata.difficulty && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <ShieldAlert className="w-3 h-3 text-sky-500" aria-hidden="true" />
                            {item.metadata.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {item.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.tags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onSelectTag(t)}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-sky-500 cursor-pointer"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectEntry(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 border border-sky-500/25 shrink-0 self-start sm:self-center transition-colors cursor-pointer"
                    >
                      <BookMarked className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Consultar ficha</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

