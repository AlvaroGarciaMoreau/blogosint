import React, { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { User } from 'firebase/auth';
import {
  Bookmark,
  BookOpen,
  Calendar,
  Clock,
  Cloud,
  Compass,
  ExternalLink,
  Filter,
  FolderGit2,
  Layers,
  Lock,
  Menu,
  Moon,
  PlusCircle,
  Radar,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import {
  ActiveView,
  CATEGORY_CONFIG,
  DayCategory,
  ORDERED_CATEGORIES,
  OsintEntry,
  PricingModel,
} from './types/osint';
import {
  batchUpsertEntriesToFirestore,
  clearEntriesLocalCache,
  deleteEntryFromFirestore,
  isUserAdmin,
  loadCachedEntries,
  saveEntriesToLocalCache,
  saveEntryToFirestore,
  subscribeToAuthChanges,
  subscribeToEntriesIncremental,
} from './services/firebase';
import { ArticleReader } from './components/ArticleReader';
import { CommandPalette } from './components/CommandPalette';
import { ToolsDirectory } from './components/ToolsDirectory';
import { WikiGlossary } from './components/WikiGlossary';
import { AdminPanel } from './components/AdminPanel';

export const App: React.FC = () => {
  // Entries state initialized strictly from local cache of Firebase entries (no test seed data)
  const [entries, setEntries] = useState<OsintEntry[]>(() => loadCachedEntries().entries);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  // Navigation & View states
  const [activeView, setActiveView] = useState<ActiveView>('feed');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<OsintEntry | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Combinable Filters for Feed
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DayCategory | 'ALL'>('ALL');
  const [selectedPricing, setSelectedPricing] = useState<PricingModel | 'ALL'>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | 'ALL'>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Theme state following modern-web-guidance dark-mode-toggle
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsubAuth = subscribeToAuthChanges((u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Incremental Firestore sync (downloads only missing or updated entries via updatedAt cursor)
  useEffect(() => {
    const unsubEntries = subscribeToEntriesIncremental(
      (syncedEntries) => {
        setCloudConnected(true);
        setEntries(syncedEntries);
      },
      () => {
        setCloudConnected(false);
      }
    );
    return () => unsubEntries();
  }, [syncEpoch]);

  // Global keyboard shortcut Ctrl+K / Cmd+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync page title per view for accessibility
  useEffect(() => {
    const currentArticle = entries.find((e) => e.id === selectedEntryId);
    if (activeView === 'article' && currentArticle) {
      document.title = `${currentArticle.title} | OSINT Daily KB`;
    } else if (activeView === 'tools') {
      document.title = 'Caja de Herramientas | OSINT Daily KB';
    } else if (activeView === 'wiki') {
      document.title = 'Glosario y Wiki de Técnicas | OSINT Daily KB';
    } else if (activeView === 'admin') {
      document.title = 'Panel de Administración | OSINT Daily KB';
    } else {
      document.title = 'OSINT Daily Knowledge Base — Cápsulas Diarias';
    }
  }, [activeView, selectedEntryId, entries]);

  // Two-state system-aware color-scheme toggle per modern-web-guidance
  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const targetScheme = nextDark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="color-scheme"]');

    try {
      if ((nextDark && systemPrefersDark) || (!nextDark && !systemPrefersDark)) {
        localStorage.removeItem('color-scheme');
        if (meta) meta.setAttribute('content', 'light dark');
      } else {
        localStorage.setItem('color-scheme', targetScheme);
        if (meta) meta.setAttribute('content', targetScheme);
      }
    } catch {
      if (meta) meta.setAttribute('content', targetScheme);
    }
  };

  // All unique tags with counts
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Fuzzy Search + Combinable Filters (100% client-side over cached entries — 0 extra reads)
  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: [
          { name: 'title', weight: 0.45 },
          { name: 'tags', weight: 0.25 },
          { name: 'summary', weight: 0.2 },
          { name: 'content', weight: 0.1 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    let base = searchQuery.trim()
      ? fuse.search(searchQuery.trim()).map((r) => r.item)
      : [...entries].sort((a, b) => b.date.localeCompare(a.date));

    if (selectedCategory !== 'ALL') {
      base = base.filter((e) => e.dayCategory === selectedCategory);
    }

    if (selectedCategory === 'MARTES_HERRAMIENTA' && selectedPricing !== 'ALL') {
      base = base.filter((e) => e.metadata.pricingModel === selectedPricing);
    }

    if (selectedTag !== 'ALL') {
      base = base.filter((e) => e.tags.includes(selectedTag));
    }

    if (onlyFavorites) {
      base = base.filter((e) => e.isFavorite);
    }

    return base;
  }, [
    entries,
    fuse,
    searchQuery,
    selectedCategory,
    selectedPricing,
    selectedTag,
    onlyFavorites,
  ]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) ?? entries[0] ?? null,
    [entries, selectedEntryId]
  );

  const isAdmin = isUserAdmin(user);

  const updateLocalStateAndCache = (next: OsintEntry[], newestTimestamp?: string) => {
    const sorted = [...next].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(sorted);
    saveEntriesToLocalCache(sorted, newestTimestamp);
  };

  const handleOpenArticle = (entry: OsintEntry) => {
    setSelectedEntryId(entry.id);
    setActiveView('article');
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTagAndGoFeed = (tag: string) => {
    setSelectedTag(tag);
    setActiveView('feed');
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = async (entry: OsintEntry) => {
    const updated: OsintEntry = { ...entry, isFavorite: !entry.isFavorite };
    const nextList = entries.map((item) => (item.id === entry.id ? updated : item));
    updateLocalStateAndCache(nextList);
    if (isAdmin) {
      try {
        const saved = await saveEntryToFirestore(updated, entry.createdAt);
        updateLocalStateAndCache(
          entries.map((item) => (item.id === saved.id ? saved : item)),
          saved.updatedAt
        );
      } catch {
        // local cache already updated
      }
    }
  };

  const handleUpdateInteractiveEntry = async (updated: OsintEntry) => {
    const nextList = entries.map((item) => (item.id === updated.id ? updated : item));
    updateLocalStateAndCache(nextList);
    if (isAdmin) {
      try {
        const saved = await saveEntryToFirestore(updated, updated.createdAt);
        updateLocalStateAndCache(
          entries.map((item) => (item.id === saved.id ? saved : item)),
          saved.updatedAt
        );
      } catch {
        // local cache already updated
      }
    }
  };

  const handleSaveEntryFromAdmin = async (
    newEntry: OsintEntry,
    existingCreatedAt?: string
  ) => {
    const saved = await saveEntryToFirestore(newEntry, existingCreatedAt);
    const exists = entries.some((e) => e.id === saved.id);
    const nextList = exists
      ? entries.map((e) => (e.id === saved.id ? saved : e))
      : [saved, ...entries];
    updateLocalStateAndCache(nextList, saved.updatedAt);
  };

  const handleDeleteEntryFromAdmin = async (entryId: string) => {
    await deleteEntryFromFirestore(entryId);
    const nextList = entries.filter((e) => e.id !== entryId);
    updateLocalStateAndCache(nextList);
  };

  const handleImportEntries = async (imported: OsintEntry[]) => {
    const savedList = await batchUpsertEntriesToFirestore(
      imported as unknown as Array<Partial<OsintEntry> & Record<string, unknown>>
    );
    const mergedMap = new Map<string, OsintEntry>();
    for (const existing of entries) {
      mergedMap.set(existing.id, existing);
    }
    let newestTs = '';
    for (const saved of savedList) {
      mergedMap.set(saved.id, saved);
      if (saved.updatedAt && saved.updatedAt > newestTs) {
        newestTs = saved.updatedAt;
      }
    }
    updateLocalStateAndCache(Array.from(mergedMap.values()), newestTs || undefined);
  };

  const handleForceCacheRefresh = () => {
    clearEntriesLocalCache();
    setEntries([]);
    setSyncEpoch((prev) => prev + 1);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedPricing('ALL');
    setSelectedTag('ALL');
    setOnlyFavorites(false);
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-x-clip">
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-cyan-600 focus:text-white focus:font-semibold"
      >
        Saltar al contenido principal
      </a>

      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] w-full mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Brand & Mobile Drawer Button */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((o) => !o)}
              aria-label="Abrir menú de navegación"
              aria-expanded={mobileSidebarOpen}
              className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              {mobileSidebarOpen ? (
                <X className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('feed');
                clearAllFilters();
              }}
              className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer shrink-0"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-xs shrink-0">
                <Radar className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" aria-hidden="true" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
                  <span>OSINT Daily</span>
                  <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25">
                    Knowledge Base
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  Cápsulas diarias de Inteligencia de Fuentes Abiertas
                </p>
              </div>
            </button>
          </div>

          {/* Instant Search Trigger (Command Palette Ctrl+K) */}
          <div className="flex-1 min-w-0 max-w-md sm:mx-2">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              aria-label="Abrir buscador instantáneo (Ctrl + K)"
              className="w-full min-w-0 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer overflow-hidden"
            >
              <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 shrink-0" aria-hidden="true" />
                <span className="truncate sm:hidden">Buscar...</span>
                <span className="hidden sm:inline truncate">
                  Buscar técnica, herramienta, dork...
                </span>
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Actions: Cloud Cache Status, Theme Toggle, Admin Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
              title="Caché incremental activa: solo se descargan entradas nuevas o modificadas desde Firebase"
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  cloudConnected ? 'text-emerald-500' : 'text-amber-500'
                }`}
                aria-hidden="true"
              />
              <span>{cloudConnected ? 'Caché + Delta Sync' : 'Caché Local'}</span>
            </span>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setActiveView('admin');
              }}
              aria-label={isAdmin ? 'Ir al CMS para crear o gestionar cápsulas' : 'Acceso Administración'}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                activeView === 'admin'
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                  : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-800 dark:border-slate-700 hover:bg-slate-800 dark:hover:bg-slate-700'
              }`}
            >
              {isAdmin ? (
                <>
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] sm:hidden">CMS</span>
                  <span className="hidden sm:inline">Nueva Cápsula</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs">Admin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Shell */}
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-8 items-start">
        {/* Left Navigation Sidebar */}
        <aside
          aria-label="Navegación e índices OSINT"
          className={`${
            mobileSidebarOpen ? 'block' : 'hidden'
          } lg:block lg:sticky lg:top-22 space-y-6 bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs`}
        >
          {/* Specialized Index Views */}
          <nav aria-label="Vistas principales">
            <div className="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Vistas de Índice
            </div>
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('feed');
                    setOnlyFavorites(false);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeView === 'feed' && !onlyFavorites
                      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-500" aria-hidden="true" />
                    Feed Cronológico
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{entries.length}</span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('tools');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeView === 'tools'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                    Caja de Herramientas
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {entries.filter((e) => e.dayCategory === 'MARTES_HERRAMIENTA').length}
                  </span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('wiki');
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeView === 'wiki'
                      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Compass className="w-4 h-4 text-sky-500" aria-hidden="true" />
                    Glosario / Wiki (Lunes)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {entries.filter((e) => e.dayCategory === 'LUNES_TECNICA').length}
                  </span>
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('feed');
                    setOnlyFavorites(true);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeView === 'feed' && onlyFavorites
                      ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-500" aria-hidden="true" />
                    Favoritos Guardados
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {entries.filter((e) => e.isFavorite).length}
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          {/* Weekly Taxonomy Filter (Lunes a Viernes) */}
          <nav aria-label="Taxonomía semanal OSINT" className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="px-2.5 pb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Programación Semanal</span>
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedPricing('ALL');
                  }}
                  className="text-cyan-500 hover:underline capitalize font-normal cursor-pointer"
                >
                  Todas
                </button>
              )}
            </div>

            <ul className="space-y-1">
              {ORDERED_CATEGORIES.map((catKey) => {
                const cat = CATEGORY_CONFIG[catKey];
                const count = entries.filter((e) => e.dayCategory === catKey).length;
                const isSelected = selectedCategory === catKey && activeView === 'feed';
                return (
                  <li key={catKey}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(isSelected ? 'ALL' : catKey);
                        setSelectedPricing('ALL');
                        setActiveView('feed');
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 font-medium'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${cat.dotColor}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {cat.dayName} · <span className="font-mono opacity-80">{cat.hashtag}</span>
                        </span>
                      </span>
                      <span className="font-mono text-[11px] opacity-70">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Popular Thematic Tags */}
          {allTags.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="px-2.5 pb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>Etiquetas Temáticas</span>
                {selectedTag !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag('ALL')}
                    className="text-cyan-500 hover:underline capitalize font-normal cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 px-1">
                {allTags.map(([tag, count]) => {
                  const active = selectedTag === tag && activeView === 'feed';
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTag(active ? 'ALL' : tag);
                        setActiveView('feed');
                        setMobileSidebarOpen(false);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-cyan-500/15 hover:text-cyan-600 dark:hover:text-cyan-300'
                      }`}
                    >
                      #{tag} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main View Area */}
        <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none">
          {activeView === 'article' && selectedEntry && (
            <ArticleReader
              entry={selectedEntry}
              onBack={() => setActiveView('feed')}
              onToggleFavorite={handleToggleFavorite}
              onUpdateEntry={handleUpdateInteractiveEntry}
              onEditInAdmin={(entryToEdit) => {
                setEditingEntry(entryToEdit);
                setActiveView('admin');
              }}
              onDeleteEntry={handleDeleteEntryFromAdmin}
              onSelectTag={handleSelectTagAndGoFeed}
              isAdmin={isAdmin}
            />
          )}

          {activeView === 'tools' && (
            <ToolsDirectory
              entries={entries}
              onSelectEntry={handleOpenArticle}
              onSelectTag={handleSelectTagAndGoFeed}
            />
          )}

          {activeView === 'wiki' && (
            <WikiGlossary
              entries={entries}
              onSelectEntry={handleOpenArticle}
              onSelectTag={handleSelectTagAndGoFeed}
            />
          )}

          {activeView === 'admin' && (
            <AdminPanel
              user={user}
              entries={entries}
              editingEntry={editingEntry}
              onClearEditing={() => setEditingEntry(null)}
              onSaveEntry={handleSaveEntryFromAdmin}
              onDeleteEntry={handleDeleteEntryFromAdmin}
              onImportEntries={handleImportEntries}
              onForceCacheRefresh={handleForceCacheRefresh}
              cloudConnected={cloudConnected}
            />
          )}

          {activeView === 'feed' && (
            <div className="space-y-6">
              {/* Feed Filter & Search Header */}
              <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      {onlyFavorites ? (
                        <>
                          <Bookmark className="w-5 h-5 text-amber-500 fill-amber-500" aria-hidden="true" />
                          <span>Cápsulas Favoritas</span>
                        </>
                      ) : selectedCategory !== 'ALL' ? (
                        <span>{CATEGORY_CONFIG[selectedCategory].fullTitle}</span>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-cyan-500" aria-hidden="true" />
                          <span>Feed Cronológico de Cápsulas OSINT</span>
                        </>
                      )}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedCategory !== 'ALL'
                        ? CATEGORY_CONFIG[selectedCategory].description
                        : 'Explora las técnicas, herramientas, casos prácticos, novedades y retos semanales.'}
                    </p>
                  </div>

                  {/* Quick Filter Reset if any filter active */}
                  {(searchQuery ||
                    selectedCategory !== 'ALL' ||
                    selectedPricing !== 'ALL' ||
                    selectedTag !== 'ALL' ||
                    onlyFavorites) && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer self-start sm:self-center"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Limpiar filtros ({filteredEntries.length})</span>
                    </button>
                  )}
                </div>

                {/* Inline Fuzzy Search Input */}
                <search>
                  <div className="relative">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <label htmlFor="feed-search-input" className="visually-hidden">
                      Filtrar cápsulas en tiempo real
                    </label>
                    <input
                      id="feed-search-input"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filtrar en tiempo real sobre la caché local por título, comando o etiqueta..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-2 focus:outline-cyan-500"
                    />
                  </div>
                </search>

                {/* Category Pill Strip */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('ALL');
                      setSelectedPricing('ALL');
                    }}
                    aria-pressed={selectedCategory === 'ALL'}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
                    }`}
                  >
                    Todos los días
                  </button>

                  {ORDERED_CATEGORIES.map((catId) => {
                    const cat = CATEGORY_CONFIG[catId];
                    const active = selectedCategory === catId;
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(active ? 'ALL' : catId);
                          setSelectedPricing('ALL');
                        }}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? cat.badgeClasses + ' ring-1 ring-current'
                            : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-200/60'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cat.dotColor}`} aria-hidden="true" />
                        <span>{cat.dayName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Sub-Filter for Tuesday Tools: Gratuita | Freemium | De Pago */}
                {selectedCategory === 'MARTES_HERRAMIENTA' && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                      Sub-filtro por licencia de herramienta:
                    </span>
                    {(['ALL', 'Gratuita', 'Freemium', 'De Pago'] as const).map((lic) => {
                      const active = selectedPricing === lic;
                      return (
                        <button
                          key={lic}
                          type="button"
                          onClick={() => setSelectedPricing(lic)}
                          aria-pressed={active}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {lic === 'ALL' ? 'Todas' : lic}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Capsule Cards List */}
              {entries.length === 0 ? (
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                    Todavía no hay cápsulas publicadas en Firebase Firestore.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Accede al panel de administración para publicar tu primera cápsula diaria generada con Gemini.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('admin')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Ir a Administración</span>
                  </button>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                    No se encontraron cápsulas que coincidan con los filtros activos.
                  </p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 text-white cursor-pointer"
                  >
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEntries.map((entry) => {
                    const cat = CATEGORY_CONFIG[entry.dayCategory];
                    const formattedDate = new Intl.DateTimeFormat('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(entry.date));

                    return (
                      <article
                        key={entry.id}
                        className={`group bg-white dark:bg-slate-900/85 border border-slate-200/90 dark:border-slate-800/90 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 border-l-4 ${cat.borderAccent} rounded-2xl p-5 sm:p-6 shadow-xs transition-all`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cat.badgeClasses}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${cat.dotColor}`}
                                aria-hidden="true"
                              />
                              {cat.dayName} · {cat.hashtag}
                            </span>

                            {entry.metadata.pricingModel && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                                {entry.metadata.pricingModel}
                              </span>
                            )}

                            {entry.metadata.difficulty && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                                <ShieldAlert className="w-3 h-3 text-cyan-500" aria-hidden="true" />
                                {entry.metadata.difficulty}
                              </span>
                            )}

                            {entry.metadata.caseStatus && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                                Caso: {entry.metadata.caseStatus}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                              {formattedDate}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              {entry.readingTimeMinutes} min
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(entry)}
                              aria-label={
                                entry.isFavorite
                                  ? `Quitar ${entry.title} de favoritos`
                                  : `Guardar ${entry.title} en favoritos`
                              }
                              aria-pressed={entry.isFavorite}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                entry.isFavorite
                                  ? 'text-amber-500 bg-amber-500/10'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Bookmark
                                className={`w-4 h-4 ${entry.isFavorite ? 'fill-current' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>

                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors mb-2 leading-snug">
                          <button
                            type="button"
                            onClick={() => handleOpenArticle(entry)}
                            className="text-left cursor-pointer"
                          >
                            {entry.title}
                          </button>
                        </h2>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                          {entry.summary}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/70">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setSelectedTag(selectedTag === tag ? 'ALL' : tag)}
                                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                                  selectedTag === tag
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300'
                                }`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-3">
                            {entry.metadata.toolUrl && (
                              <a
                                href={entry.metadata.toolUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                <span>Web de la herramienta</span>
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenArticle(entry)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-cyan-600 dark:hover:bg-cyan-600 text-white transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Leer cápsula</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800/80 py-6 bg-white/60 dark:bg-slate-900/40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" aria-hidden="true" />
            <span>
              <strong>OSINT Daily Knowledge Base</strong> — Sincronización incremental con Firebase Firestore
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>Atajo de búsqueda: Ctrl + K</span>
            <a
              href="https://github.com/AlvaroGarciaMoreau/blogosint"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors"
            >
              <FolderGit2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Command Palette Modal (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        entries={entries}
        onSelectEntry={handleOpenArticle}
        onSelectTag={handleSelectTagAndGoFeed}
      />
    </div>
  );
};

export default App;
