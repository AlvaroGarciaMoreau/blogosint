import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Flame,
  Laptop,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react';
import { CATEGORY_CONFIG, ChecklistItem, OsintEntry } from '../types/osint';
import { extractTocHeadings, MarkdownRenderer } from './MarkdownRenderer';

interface ArticleReaderProps {
  entry: OsintEntry;
  onBack: () => void;
  onToggleFavorite: (entry: OsintEntry) => void;
  onUpdateEntry: (entry: OsintEntry) => void;
  onEditInAdmin: (entry: OsintEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onSelectTag: (tag: string) => void;
  isAdmin: boolean;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  entry,
  onBack,
  onToggleFavorite,
  onUpdateEntry,
  onEditInAdmin,
  onDeleteEntry,
  onSelectTag,
  isAdmin,
}) => {
  const category = CATEGORY_CONFIG[entry.dayCategory];
  const headings = useMemo(() => extractTocHeadings(entry.content), [entry.content]);
  const [activeHeadingId, setActiveHeadingId] = useState<string>(headings[0]?.id ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 15-minute (900 seconds) Express Challenge Timer for Fridays
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Local checklist state synced with entry metadata
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    entry.metadata.checklist ?? []
  );
  const [challengeDone, setChallengeDone] = useState<boolean>(
    Boolean(entry.metadata.challengeCompleted)
  );

  useEffect(() => {
    setChecklist(entry.metadata.checklist ?? []);
    setChallengeDone(Boolean(entry.metadata.challengeCompleted));
    setSecondsLeft(15 * 60);
    setTimerRunning(false);
  }, [entry.id, entry.metadata.checklist, entry.metadata.challengeCompleted]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  // Scroll-spy for Table of Contents (TOC)
  useEffect(() => {
    if (headings.length === 0) return;
    setActiveHeadingId(headings[0].id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveHeadingId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-80px 0px -65% 0px',
        threshold: [0, 1],
      }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleChecklistItem = (itemId: string) => {
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    const allCompleted = updated.length > 0 && updated.every((i) => i.completed);
    setChallengeDone(allCompleted);
    onUpdateEntry({
      ...entry,
      metadata: {
        ...entry.metadata,
        checklist: updated,
        challengeCompleted: allCompleted,
      },
    });
  };

  const handleToggleChallengeCompleted = () => {
    const next = !challengeDone;
    setChallengeDone(next);
    onUpdateEntry({
      ...entry,
      metadata: {
        ...entry.metadata,
        challengeCompleted: next,
      },
    });
  };

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(entry.date));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-8 items-start min-w-0">
      {/* Main Article Column */}
      <article className="min-w-0 bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-8 lg:p-10 shadow-xs overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Volver al índice</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(entry)}
              aria-pressed={entry.isFavorite}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                entry.isFavorite
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${entry.isFavorite ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
              <span>{entry.isFavorite ? 'Guardado en Favoritos' : 'Guardar'}</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => onEditInAdmin(entry)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Editar cápsula</span>
                </button>

                {confirmingDelete ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      ¿Eliminar de Firebase?
                    </span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await onDeleteEntry(entry.id);
                          onBack();
                        } finally {
                          setIsDeleting(false);
                          setConfirmingDelete(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                    >
                      {isDeleting ? 'Borrando...' : 'Sí, borrar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Eliminar cápsula</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Category & Metadata Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${category.badgeClasses}`}
            >
              <span className={`w-2 h-2 rounded-full ${category.dotColor}`} aria-hidden="true" />
              {category.dayName} · {category.hashtag}
            </span>

            {entry.metadata.difficulty && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
                Nivel: {entry.metadata.difficulty}
              </span>
            )}

            {entry.metadata.pricingModel && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  entry.metadata.pricingModel === 'Gratuita'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                    : entry.metadata.pricingModel === 'Freemium'
                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                }`}
              >
                Licencia: {entry.metadata.pricingModel}
              </span>
            )}

            {entry.metadata.caseStatus && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  entry.metadata.caseStatus === 'Resuelto'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                    : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25'
                }`}
              >
                Estado: {entry.metadata.caseStatus}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
            {entry.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
            {entry.summary}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 capitalize">
              <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {formattedDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {entry.readingTimeMinutes} min de lectura
            </span>
          </div>
        </header>

        {/* Conditional Category Callout Box */}
        {entry.dayCategory === 'MARTES_HERRAMIENTA' && (
          <section
            aria-label="Ficha técnica de la herramienta"
            className="mb-8 p-4 sm:p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <Wrench className="w-4 h-4" aria-hidden="true" />
                Ficha Técnica de Herramienta OSINT
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                <span>
                  <strong>Licencia:</strong> {entry.metadata.pricingModel ?? 'No especificada'}
                </span>
                {entry.metadata.osCompatibility && (
                  <span className="inline-flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                    <strong>Plataforma:</strong> {entry.metadata.osCompatibility}
                  </span>
                )}
              </div>
            </div>

            {entry.metadata.toolUrl && (
              <a
                href={entry.metadata.toolUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors shrink-0"
              >
                <span>Abrir Web Oficial</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </section>
        )}

        {entry.dayCategory === 'MIERCOLES_CASO' &&
          entry.metadata.toolsUsed &&
          entry.metadata.toolsUsed.length > 0 && (
            <section
              aria-label="Herramientas empleadas en el caso práctico"
              className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/25"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">
                Stack utilizado en este Caso Práctico
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.metadata.toolsUsed.map((tool) => (
                  <span
                    key={tool}
                    className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-white dark:bg-slate-900 border border-amber-500/30 text-slate-800 dark:text-slate-200"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </section>
          )}

        {entry.dayCategory === 'JUEVES_NOVEDAD' && entry.metadata.sourceUrl && (
          <section
            aria-label="Fuente original de la noticia"
            className="mb-8 p-4 rounded-xl bg-violet-500/5 border border-violet-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <strong className="text-violet-700 dark:text-violet-300 block text-xs uppercase tracking-wider mb-0.5">
                Referencia / Fuente Primaria
              </strong>
              <span className="font-mono text-xs break-all">{entry.metadata.sourceUrl}</span>
            </div>
            <a
              href={entry.metadata.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0"
            >
              <span>Consultar Fuente Original</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </section>
        )}

        {/* Friday Challenge 15-min Timer & Interactive Checklist */}
        {entry.dayCategory === 'VIERNES_RETO' && (
          <section
            aria-label="Temporizador y checklist del Reto Express"
            className="mb-8 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/25 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-500/15">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  Temporizador Integrado — Reto Express (15 min)
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Pon a prueba tu flujo de investigación en menos de 15 minutos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  role="timer"
                  aria-label="Tiempo restante del reto"
                  className={`font-mono text-2xl font-bold px-3.5 py-1.5 rounded-xl border ${
                    secondsLeft === 0
                      ? 'bg-rose-600 text-white border-rose-600'
                      : timerRunning
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {formatTimer(secondsLeft)}
                </div>

                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Iniciar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setSecondsLeft(15 * 60);
                  }}
                  aria-label="Reiniciar temporizador a 15 minutos"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {checklist.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-rose-500" aria-hidden="true" />
                    Checklist de Resolución
                  </span>
                  <span>
                    {checklist.filter((i) => i.completed).length} / {checklist.length} completados
                  </span>
                </div>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800"
                    >
                      <input
                        type="checkbox"
                        id={`chk-${entry.id}-${item.id}`}
                        checked={item.completed}
                        onChange={() => handleToggleChecklistItem(item.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-rose-600 cursor-pointer"
                      />
                      <label
                        htmlFor={`chk-${entry.id}-${item.id}`}
                        className={`text-sm cursor-pointer select-none ${
                          item.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.text}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Estado del reto semanal:
              </span>
              <button
                type="button"
                onClick={handleToggleChallengeCompleted}
                aria-pressed={challengeDone}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  challengeDone
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{challengeDone ? 'Reto Superado' : 'Marcar como Resuelto'}</span>
              </button>
            </div>
          </section>
        )}

        {/* Markdown Body */}
        <MarkdownRenderer content={entry.content} />

        {/* Footer Tags */}
        <footer className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              <Tag className="w-3.5 h-3.5" aria-hidden="true" />
              Etiquetas:
            </span>
            {entry.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(tag)}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/15 hover:text-cyan-700 dark:hover:text-cyan-300 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                #{tag}
              </button>
            ))}
          </div>
        </footer>
      </article>

      {/* Right Sidebar: Automatic Table of Contents (TOC) */}
      <aside
        aria-label="Tabla de contenidos del artículo"
        className="hidden xl:block sticky top-24 bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-xs"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
          <span>En esta cápsula (TOC)</span>
        </div>

        {headings.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Esta cápsula no contiene sub-encabezados H2/H3.
          </p>
        ) : (
          <nav aria-label="Índice de secciones">
            <ul className="space-y-1.5 text-xs">
              {headings.map((h) => {
                const isActive = activeHeadingId === h.id;
                return (
                  <li key={h.id} className={h.level === 3 ? 'pl-3.5' : ''}>
                    <a
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const target = document.getElementById(h.id);
                        if (target) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          setActiveHeadingId(h.id);
                        }
                      }}
                      className={`block py-1 px-2 rounded-md transition-colors border-l-2 ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {h.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </aside>
    </div>
  );
};

