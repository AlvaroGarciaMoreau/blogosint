import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FileCode,
  FileJson,
  Lock,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  CaseStatus,
  CATEGORY_CONFIG,
  ChecklistItem,
  DayCategory,
  detectCategoryFromDate,
  DifficultyLevel,
  estimateReadingTime,
  ORDERED_CATEGORIES,
  OsintEntry,
  PricingModel,
  slugify,
} from '../types/osint';
import {
  isUserAdmin,
  signInAdminWithEmail,
  signOutAdmin,
} from '../services/firebase';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AdminPanelProps {
  user: User | null;
  entries: OsintEntry[];
  editingEntry: OsintEntry | null;
  onClearEditing: () => void;
  onSaveEntry: (entry: OsintEntry, existingCreatedAt?: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onImportEntries: (entries: OsintEntry[]) => Promise<void>;
  onForceCacheRefresh: () => void;
  cloudConnected: boolean;
}

const SUGGESTED_TAGS = [
  'Geolocalización',
  'RedesSociales',
  'Dominios',
  'Cripto',
  'BrechasDeDatos',
  'Infraestructura',
  'SOCMINT',
  'Dorks',
  'Metadatos',
  'Certificados',
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  entries,
  editingEntry,
  onClearEditing,
  onSaveEntry,
  onDeleteEntry,
  onImportEntries,
  onForceCacheRefresh,
  cloudConnected,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Auth form states (Email & Password only, pre-provisioned in Firebase Auth)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Entry Form States
  const [entryId, setEntryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState(todayStr);
  const [dayCategory, setDayCategory] = useState<DayCategory>(() =>
    detectCategoryFromDate(todayStr)
  );
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>(['Reconocimiento']);
  const [tagInput, setTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  // Conditional metadata fields
  const [pricingModel, setPricingModel] = useState<PricingModel>('Gratuita');
  const [toolUrl, setToolUrl] = useState('');
  const [osCompatibility, setOsCompatibility] = useState('Web / Multiplataforma (CLI)');
  const [sourceUrl, setSourceUrl] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Intermedio');
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('Resuelto');
  const [toolsUsedText, setToolsUsedText] = useState('');
  const [checklistText, setChecklistText] = useState(
    'Identificar el vector inicial del objetivo\nPivotar sobre identificadores secundarios\nVerificar y documentar hallazgos con capturas y hashes'
  );
  const [challengeCompleted, setChallengeCompleted] = useState(false);

  // Status & Feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = isUserAdmin(user);

  const handleConfirmDeleteEntry = async (idToDelete: string, entryTitle: string) => {
    setStatusMessage(null);
    setIsDeletingId(idToDelete);
    try {
      await onDeleteEntry(idToDelete);
      if (entryId === idToDelete) {
        onClearEditing();
        resetFormToToday();
      }
      setConfirmDeleteId(null);
      setStatusMessage({
        type: 'success',
        text: `La cápsula «${entryTitle}» ha sido eliminada de Firebase Firestore y de la caché local.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la entrada';
      setStatusMessage({
        type: 'error',
        text: `No se pudo eliminar la cápsula: ${msg}`,
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  // Populate form when editing an existing entry
  useEffect(() => {
    if (editingEntry) {
      setEntryId(editingEntry.id);
      setTitle(editingEntry.title);
      setDateStr(editingEntry.date.slice(0, 10));
      setDayCategory(editingEntry.dayCategory);
      setSummary(editingEntry.summary);
      setContent(editingEntry.content);
      setTags(editingEntry.tags);
      setIsFavorite(editingEntry.isFavorite);
      setPricingModel(editingEntry.metadata.pricingModel ?? 'Gratuita');
      setToolUrl(editingEntry.metadata.toolUrl ?? '');
      setOsCompatibility(editingEntry.metadata.osCompatibility ?? 'Web / Multiplataforma');
      setSourceUrl(editingEntry.metadata.sourceUrl ?? '');
      setDifficulty(editingEntry.metadata.difficulty ?? 'Intermedio');
      setCaseStatus(editingEntry.metadata.caseStatus ?? 'Resuelto');
      setToolsUsedText((editingEntry.metadata.toolsUsed ?? []).join(', '));
      setChecklistText(
        (editingEntry.metadata.checklist ?? []).map((c) => c.text).join('\n')
      );
      setChallengeCompleted(Boolean(editingEntry.metadata.challengeCompleted));
    } else {
      resetFormToToday();
    }
  }, [editingEntry]);

  const resetFormToToday = () => {
    const nowStr = new Date().toISOString().slice(0, 10);
    setEntryId('');
    setTitle('');
    setDateStr(nowStr);
    setDayCategory(detectCategoryFromDate(nowStr));
    setSummary('');
    setContent('');
    setTags(['OSINT']);
    setTagInput('');
    setIsFavorite(false);
    setPricingModel('Gratuita');
    setToolUrl('');
    setOsCompatibility('Linux, macOS, Windows / Web');
    setSourceUrl('');
    setDifficulty('Intermedio');
    setCaseStatus('Resuelto');
    setToolsUsedText('');
    setChecklistText(
      'Extraer indicadores técnicos iniciales\nContrastarlos en una segunda fuente independiente\nRegistrar conclusión en menos de 15 minutos'
    );
    setChallengeCompleted(false);
  };

  const handleDateChange = (newDate: string) => {
    setDateStr(newDate);
    if (!editingEntry) {
      setDayCategory(detectCategoryFromDate(`${newDate}T09:00:00`));
    }
  };

  const handleSmartParseGemini = () => {
    if (!content.trim()) return;
    const lines = content.trim().split('\n');
    let extractedTitle = title;
    let remainingContent = content;

    const firstLineMatch = /^#\s+(.+)$/.exec(lines[0].trim());
    if (firstLineMatch && !extractedTitle.trim()) {
      extractedTitle = firstLineMatch[1].replace(/\*\*/g, '').trim();
      remainingContent = lines.slice(1).join('\n').trim();
      setTitle(extractedTitle);
      setContent(remainingContent);
    }

    if (!summary.trim()) {
      const firstPara = remainingContent
        .split('\n')
        .map((l) => l.trim())
        .find(
          (l) =>
            l.length > 35 &&
            !l.startsWith('#') &&
            !l.startsWith('```') &&
            !l.startsWith('|')
        );
      if (firstPara) {
        setSummary(firstPara.replace(/\*\*([^*]+)\*\*/g, '$1').slice(0, 280));
      }
    }

    setStatusMessage({
      type: 'success',
      text: 'Metadatos autocompletados a partir del Markdown de Gemini.',
    });
  };

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.replace(/^#/, '').trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim() || !content.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor, completa al menos el título y el contenido Markdown de la cápsula.',
      });
      return;
    }

    if (dayCategory === 'MARTES_HERRAMIENTA' && !toolUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'En las cápsulas de los Martes (#Herramienta), la URL oficial es obligatoria.',
      });
      return;
    }

    if (dayCategory === 'JUEVES_NOVEDAD' && !sourceUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'En las cápsulas de los Jueves (#Novedad), el enlace a la fuente original es obligatorio.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedSlug = slugify(title) || `capsula-${Date.now()}`;
      const id = entryId || `${dateStr}-${generatedSlug}`.slice(0, 100);
      const isoDate = `${dateStr}T09:00:00Z`;

      const parsedChecklist: ChecklistItem[] | null =
        dayCategory === 'VIERNES_RETO'
          ? checklistText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((text, idx) => ({
                id: `chk-${idx + 1}`,
                text,
                completed: false,
              }))
          : null;

      const parsedToolsUsed: string[] | null =
        dayCategory === 'MIERCOLES_CASO' && toolsUsedText.trim()
          ? toolsUsedText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : null;

      const newEntry: OsintEntry = {
        id,
        title: title.trim(),
        slug: generatedSlug,
        date: isoDate,
        dayCategory,
        tags: tags.length > 0 ? tags : ['OSINT'],
        summary:
          summary.trim() ||
          content
            .replace(/[#*`>-]/g, '')
            .trim()
            .slice(0, 200) + '...',
        content,
        metadata: {
          pricingModel: dayCategory === 'MARTES_HERRAMIENTA' ? pricingModel : null,
          toolUrl: dayCategory === 'MARTES_HERRAMIENTA' ? toolUrl.trim() : null,
          osCompatibility:
            dayCategory === 'MARTES_HERRAMIENTA' ? osCompatibility.trim() : null,
          sourceUrl: dayCategory === 'JUEVES_NOVEDAD' ? sourceUrl.trim() : null,
          difficulty,
          caseStatus: dayCategory === 'MIERCOLES_CASO' ? caseStatus : null,
          toolsUsed: parsedToolsUsed,
          challengeCompleted:
            dayCategory === 'VIERNES_RETO' ? challengeCompleted : false,
          checklist: parsedChecklist,
        },
        isFavorite,
        readingTimeMinutes: estimateReadingTime(content),
      };

      await onSaveEntry(newEntry, editingEntry?.createdAt);
      setStatusMessage({
        type: 'success',
        text: editingEntry
          ? 'Cápsula actualizada en Firestore y en caché local.'
          : 'Nueva cápsula publicada en Firestore y añadida a la caché.',
      });
      if (!editingEntry) {
        resetFormToToday();
      } else {
        onClearEditing();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar';
      setStatusMessage({
        type: 'error',
        text: `Error al guardar en Firestore: ${msg}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export JSON Backup
  const handleExportJson = () => {
    const payload = JSON.stringify(entries, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osint-daily-kb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Markdown Bundle (.md with YAML frontmatter)
  const handleExportMarkdownBundle = () => {
    const bundle = entries
      .map((entry) => {
        return [
          '---',
          `id: "${entry.id}"`,
          `title: "${entry.title.replace(/"/g, '\\"')}"`,
          `slug: "${entry.slug}"`,
          `date: "${entry.date}"`,
          `dayCategory: "${entry.dayCategory}"`,
          `tags: [${entry.tags.map((t) => `"${t}"`).join(', ')}]`,
          `pricingModel: ${entry.metadata.pricingModel ? `"${entry.metadata.pricingModel}"` : 'null'}`,
          `toolUrl: ${entry.metadata.toolUrl ? `"${entry.metadata.toolUrl}"` : 'null'}`,
          `sourceUrl: ${entry.metadata.sourceUrl ? `"${entry.metadata.sourceUrl}"` : 'null'}`,
          `difficulty: ${entry.metadata.difficulty ? `"${entry.metadata.difficulty}"` : 'null'}`,
          '---',
          '',
          `# ${entry.title}`,
          '',
          `> ${entry.summary}`,
          '',
          entry.content,
          '',
          '---',
          '',
        ].join('\n');
      })
      .join('\n');

    const blob = new Blob([bundle], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osint-daily-kb-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON Backup (supports array of entries or single entry object)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: OsintEntry[] = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)
          ? parsed.entries
          : parsed && typeof parsed === 'object'
            ? [parsed as OsintEntry]
            : [];

      if (list.length === 0) {
        throw new Error('El archivo JSON está vacío o no contiene cápsulas válidas.');
      }

      await onImportEntries(list);
      setStatusMessage({
        type: 'success',
        text: `Se han importado y sincronizado ${list.length} cápsula(s) en Firebase y caché local.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Formato inválido';
      setStatusMessage({
        type: 'error',
        text: `Error al importar JSON: ${msg}`,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInAdminWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-email'
      ) {
        setAuthError('Credenciales incorrectas. Verifica el correo y la contraseña.');
      } else if (code === 'auth/too-many-requests') {
        setAuthError(
          'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.'
        );
      } else {
        const msg = err instanceof Error ? err.message : 'Error de autenticación';
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Private Login Gate (Email + Password only, no registration, no password recovery)
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1
              id="admin-login-heading"
              className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white"
            >
              Acceso de Administración
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Área privada restringida a cuentas autorizadas.
            </p>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{authError}</span>
          </div>
        )}

        <form
          onSubmit={handleEmailLogin}
          aria-labelledby="admin-login-heading"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Correo electrónico <span aria-hidden="true">*</span>
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder="admin@dominio.com"
              value={loginEmail}
              onChange={(e) => {
                setLoginEmail(e.target.value);
                if (authError) setAuthError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-2 focus:outline-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Contraseña <span aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-2 focus:outline-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>{authLoading ? 'Verificando acceso...' : 'Iniciar sesión'}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Admin Header & Backup Controls */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Sesión Admin activa: {user?.email}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            CMS Integrado — Flujo Copiar y Pegar desde Gemini
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Vuelca tu cápsula diaria en segundos con detección automática de categoría y previsualización en tiempo real.
          </p>
        </div>

        {/* Backup & Portability Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onForceCacheRefresh}
            title="Limpia la caché local y vuelve a sincronizar todas las entradas desde Firebase"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refrescar Caché</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <span>Exportar .JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportMarkdownBundle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
            <span>Exportar .MD</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            <span>Importar .JSON</span>
          </button>

          <button
            type="button"
            onClick={() => signOutAdmin()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Split-Screen Editor & Real-time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Dynamic Form */}
        <form
          onSubmit={handleSubmit}
          aria-labelledby="cms-form-heading"
          className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2
              id="cms-form-heading"
              className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-cyan-500" aria-hidden="true" />
              <span>{entryId ? 'Editar Cápsula OSINT' : 'Nueva Cápsula Diaria'}</span>
            </h2>

            {entryId && (
              <button
                type="button"
                onClick={() => {
                  onClearEditing();
                  resetFormToToday();
                }}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                + Crear nueva en su lugar
              </button>
            )}
          </div>

          {/* Date & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="entry-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Fecha de publicación <span aria-hidden="true">*</span>
              </label>
              <input
                id="entry-date"
                name="date"
                type="date"
                required
                value={dateStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="entry-category"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Categoría Semanal (Auto-detectada) <span aria-hidden="true">*</span>
              </label>
              <select
                id="entry-category"
                name="dayCategory"
                value={dayCategory}
                onChange={(e) => setDayCategory(e.target.value as DayCategory)}
                className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {ORDERED_CATEGORIES.map((catId) => {
                  const c = CATEGORY_CONFIG[catId];
                  return (
                    <option key={catId} value={catId}>
                      {c.dayName} — {c.shortTitle} ({c.hashtag})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="entry-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Título de la cápsula <span aria-hidden="true">*</span>
            </label>
            <input
              id="entry-title"
              name="title"
              type="text"
              required
              placeholder="Ej. Análisis de Maltego: Mapeo de infraestructuras y relaciones"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <label
              htmlFor="entry-summary"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Resumen ejecutivo (1–2 frases)
            </label>
            <textarea
              id="entry-summary"
              name="summary"
              rows={2}
              placeholder="Síntesis rápida para mostrar en las tarjetas de índice y buscador..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Conditional Fields by Day Category */}
          <fieldset className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Metadatos de {CATEGORY_CONFIG[dayCategory].dayName} ({CATEGORY_CONFIG[dayCategory].hashtag})
            </legend>

            {/* Difficulty selector for all days */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nivel de dificultad
              </span>
              <div className="flex flex-wrap gap-3">
                {(['Básico', 'Intermedio', 'Avanzado'] as DifficultyLevel[]).map((lvl) => (
                  <div key={lvl} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      id={`diff-${lvl}`}
                      name="difficulty"
                      value={lvl}
                      checked={difficulty === lvl}
                      onChange={() => setDifficulty(lvl)}
                      className="accent-cyan-600"
                    />
                    <label htmlFor={`diff-${lvl}`} className="text-xs font-medium cursor-pointer">
                      {lvl}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* MARTES: Pricing Model + Official URL + OS Compatibility */}
            {dayCategory === 'MARTES_HERRAMIENTA' && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Modelo de licencia (Obligatorio) <span aria-hidden="true">*</span>
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {(['Gratuita', 'Freemium', 'De Pago'] as PricingModel[]).map((pm) => (
                      <div key={pm} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          id={`pm-${pm}`}
                          name="pricingModel"
                          value={pm}
                          checked={pricingModel === pm}
                          onChange={() => setPricingModel(pm)}
                          className="accent-emerald-600"
                        />
                        <label htmlFor={`pm-${pm}`} className="text-xs font-medium cursor-pointer">
                          {pm}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="tool-url"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      URL oficial de la herramienta <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="tool-url"
                      name="toolUrl"
                      type="url"
                      required
                      placeholder="https://www.maltego.com"
                      value={toolUrl}
                      onChange={(e) => setToolUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="os-compat"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      SO compatible / Entorno Web
                    </label>
                    <input
                      id="os-compat"
                      name="osCompatibility"
                      type="text"
                      placeholder="Linux, macOS, Windows / Web"
                      value={osCompatibility}
                      onChange={(e) => setOsCompatibility(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* MIÉRCOLES: Case Status + Tools Used */}
            {dayCategory === 'MIERCOLES_CASO' && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Estado del Caso Práctico
                  </span>
                  <div className="flex gap-4">
                    {(['Resuelto', 'Pendiente'] as CaseStatus[]).map((st) => (
                      <div key={st} className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          id={`status-${st}`}
                          name="caseStatus"
                          value={st}
                          checked={caseStatus === st}
                          onChange={() => setCaseStatus(st)}
                          className="accent-amber-600"
                        />
                        <label htmlFor={`status-${st}`} className="text-xs font-medium cursor-pointer">
                          {st}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="tools-used"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Herramientas utilizadas (separadas por coma)
                  </label>
                  <input
                    id="tools-used"
                    name="toolsUsed"
                    type="text"
                    placeholder="Overpass Turbo, SunCalc, Google Earth Pro"
                    value={toolsUsedText}
                    onChange={(e) => setToolsUsedText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            )}

            {/* JUEVES: Source URL */}
            {dayCategory === 'JUEVES_NOVEDAD' && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label
                  htmlFor="source-url"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Enlace a la Fuente Original (Obligatorio) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="source-url"
                  name="sourceUrl"
                  type="url"
                  required
                  placeholder="https://..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
            )}

            {/* VIERNES: Checklist items */}
            {dayCategory === 'VIERNES_RETO' && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label
                  htmlFor="checklist-items"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Pasos de la Checklist del Reto (uno por línea)
                </label>
                <textarea
                  id="checklist-items"
                  name="checklist"
                  rows={3}
                  value={checklistText}
                  onChange={(e) => setChecklistText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>
            )}
          </fieldset>

          {/* Tags */}
          <div className="space-y-2">
            <label
              htmlFor="tag-creator-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Etiquetas Temáticas (Tags)
            </label>
            <div className="flex gap-2">
              <input
                id="tag-creator-input"
                type="text"
                placeholder="Añadir etiqueta (ej. Geolocalización)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Añadir
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    aria-label={`Eliminar etiqueta ${t}`}
                    className="ml-1 text-cyan-600 dark:text-cyan-400 hover:text-rose-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">Sugeridas:</span>
              {SUGGESTED_TAGS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleAddTag(st)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-cyan-500 cursor-pointer"
                >
                  +{st}
                </button>
              ))}
            </div>
          </div>

          {/* Markdown Content Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="markdown-editor"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Contenido en Markdown (Pega aquí la respuesta de Gemini) <span aria-hidden="true">*</span>
              </label>
              <button
                type="button"
                onClick={handleSmartParseGemini}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/25 transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Auto-extraer Título y Resumen</span>
              </button>
            </div>
            <textarea
              id="markdown-editor"
              name="content"
              rows={14}
              required
              placeholder="## ¿Qué aprenderemos hoy?\nPega directamente el texto en Markdown generado por Gemini..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 rounded-xl text-xs sm:text-sm font-mono leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                id="entry-fav"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
              <label
                htmlFor="entry-fav"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Destacar en Favoritos
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {entryId && (
                confirmDeleteId === entryId ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      ¿Eliminar esta cápsula?
                    </span>
                    <button
                      type="button"
                      disabled={isDeletingId === entryId}
                      onClick={() => handleConfirmDeleteEntry(entryId, title || entryId)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                    >
                      {isDeletingId === entryId ? 'Borrando...' : 'Sí, eliminar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(entryId)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>Eliminar cápsula</span>
                  </button>
                )
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? 'Guardando...'
                    : entryId
                      ? 'Guardar Cambios'
                      : 'Publicar Cápsula'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Right Column: Split-Screen Live Markdown Preview */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-xs space-y-4 lg:sticky lg:top-24 max-h-[85dvh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Eye className="w-4 h-4 text-cyan-500" aria-hidden="true" />
              Vista Previa en Tiempo Real
            </span>
            <span className="text-xs font-mono text-slate-400">
              ~{estimateReadingTime(content || '')} min lectura
            </span>
          </div>

          <div className="space-y-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${CATEGORY_CONFIG[dayCategory].badgeClasses}`}
            >
              {CATEGORY_CONFIG[dayCategory].dayName} · {CATEGORY_CONFIG[dayCategory].hashtag}
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {title || 'Título de la cápsula...'}
            </h3>
            {summary && (
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">{summary}</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-12 text-center">
                El contenido renderizado con resaltado de sintaxis y botones de copiado aparecerá aquí mientras escribes o pegas desde Gemini.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Existing Capsules Management Table */}
      <section
        aria-labelledby="manage-entries-heading"
        className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2
              id="manage-entries-heading"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Gestión de Cápsulas en Firebase ({entries.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Edita o elimina cualquier entrada desactualizada o incorrecta directamente en Firestore y en la caché local.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {cloudConnected ? 'Caché incremental sincronizada' : 'Conectando con Firestore...'}
          </span>
        </div>

        {entries.length > 0 && (
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="admin-entries-search" className="visually-hidden">
              Buscar cápsula para editar o eliminar
            </label>
            <input
              id="admin-entries-search"
              type="search"
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              placeholder="Buscar cápsula por título, fecha (YYYY-MM-DD) o etiqueta para editar o eliminar..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
            Todavía no hay cápsulas registradas en Firebase Firestore. Usa el formulario superior o el botón «Importar .JSON» para publicar la primera.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <caption className="visually-hidden">
                Listado de cápsulas OSINT para edición o borrado
              </caption>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th scope="col" className="py-2.5 px-3">
                    Fecha
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Categoría
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Título
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {entries
                  .filter((item) => {
                    if (!adminSearchQuery.trim()) return true;
                    const q = adminSearchQuery.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(q) ||
                      item.date.toLowerCase().includes(q) ||
                      item.tags.some((t) => t.toLowerCase().includes(q))
                    );
                  })
                  .map((item) => {
                    const cat = CATEGORY_CONFIG[item.dayCategory];
                    const isConfirming = confirmDeleteId === item.id;
                    const isDeleting = isDeletingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {item.date.slice(0, 10)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${cat.badgeClasses}`}
                          >
                            {cat.dayName}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              setConfirmDeleteId(null);
                              setEntryId(item.id);
                              setTitle(item.title);
                              setDateStr(item.date.slice(0, 10));
                              setDayCategory(item.dayCategory);
                              setSummary(item.summary);
                              setContent(item.content);
                              setTags(item.tags);
                              setIsFavorite(item.isFavorite);
                              setPricingModel(item.metadata.pricingModel ?? 'Gratuita');
                              setToolUrl(item.metadata.toolUrl ?? '');
                              setOsCompatibility(item.metadata.osCompatibility ?? '');
                              setSourceUrl(item.metadata.sourceUrl ?? '');
                              setDifficulty(item.metadata.difficulty ?? 'Intermedio');
                            }}
                            aria-label={`Editar ${item.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-500/15 hover:text-cyan-600 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>

                          {isConfirming ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-xs">
                              <span className="font-semibold text-rose-700 dark:text-rose-300">
                                ¿Confirmar?
                              </span>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleConfirmDeleteEntry(item.id, item.title)}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                              >
                                {isDeleting ? 'Borrando...' : 'Sí, eliminar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label={`Eliminar ${item.title}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Eliminar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
