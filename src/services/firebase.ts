import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  CaseStatus,
  DayCategory,
  detectCategoryFromDate,
  DifficultyLevel,
  estimateReadingTime,
  ORDERED_CATEGORIES,
  OsintEntry,
  PricingModel,
  slugify,
} from '../types/osint';

const firebaseConfig = {
  projectId: 'blogosint',
  appId: '1:11775117232:web:66e0d7b7d2bcae2465f875',
  storageBucket: 'blogosint.firebasestorage.app',
  apiKey: 'AIzaSyDdTpyPXLJKtMtGA1u82gNCwJjOWGYgka8',
  authDomain: 'blogosint.firebaseapp.com',
  messagingSenderId: '11775117232',
  measurementId: 'G-46CKP1QC1D',
};

export const app = initializeApp(firebaseConfig);

// Enable native IndexedDB persistent cache across tabs in Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);

const ENTRIES_CACHE_KEY = 'osint_daily_kb_entries_cache_v2';
const LAST_SYNC_KEY = 'osint_daily_kb_last_sync_v2';

export interface SyncStats {
  fromCacheCount: number;
  deltaDownloadedCount: number;
  lastSyncedAt: string | null;
}

export function isUserAdmin(user: User | null): boolean {
  return Boolean(user && user.uid);
}

export async function signInAdminWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function loadCachedEntries(): { entries: OsintEntry[]; lastSyncedAt: string | null } {
  try {
    // Clean up legacy v1 seed cache if present
    localStorage.removeItem('osint_daily_kb_entries_v1');

    const rawEntries = localStorage.getItem(ENTRIES_CACHE_KEY);
    const lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY);
    if (rawEntries) {
      const parsed = JSON.parse(rawEntries);
      if (Array.isArray(parsed)) {
        return { entries: parsed, lastSyncedAt };
      }
    }
  } catch {
    // ignore storage read errors
  }
  return { entries: [], lastSyncedAt: null };
}

export function saveEntriesToLocalCache(entries: OsintEntry[], lastSyncedAt?: string) {
  try {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(sorted));

    const maxUpdated = sorted.reduce((max, item) => {
      const ts = item.updatedAt || item.createdAt || '';
      return ts > max ? ts : max;
    }, lastSyncedAt || '');

    if (maxUpdated) {
      localStorage.setItem(LAST_SYNC_KEY, maxUpdated);
    }
  } catch {
    // ignore quota errors
  }
}

export function clearEntriesLocalCache() {
  try {
    localStorage.removeItem(ENTRIES_CACHE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    // ignore
  }
}

function normalizeDayCategory(rawCategory: unknown, fallbackDate: string): DayCategory {
  if (typeof rawCategory === 'string') {
    const upper = rawCategory
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
    if (ORDERED_CATEGORIES.includes(upper as DayCategory)) {
      return upper as DayCategory;
    }
    if (upper.includes('LUNES') || upper.includes('TECNICA') || upper.includes('FUNDAMENTO')) {
      return 'LUNES_TECNICA';
    }
    if (upper.includes('MARTES') || upper.includes('HERRAMIENTA')) {
      return 'MARTES_HERRAMIENTA';
    }
    if (upper.includes('MIERCOLES') || upper.includes('CASO')) {
      return 'MIERCOLES_CASO';
    }
    if (upper.includes('JUEVES') || upper.includes('NOVEDAD') || upper.includes('TENDENCIA')) {
      return 'JUEVES_NOVEDAD';
    }
    if (upper.includes('VIERNES') || upper.includes('RETO')) {
      return 'VIERNES_RETO';
    }
  }
  return detectCategoryFromDate(fallbackDate);
}

function normalizePricingModel(raw: unknown): PricingModel | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'gratuita' || v.includes('grat') || v.includes('free') || v.includes('open')) {
    return v.includes('freemium') ? 'Freemium' : 'Gratuita';
  }
  if (v === 'freemium') return 'Freemium';
  if (v === 'de pago' || v.includes('pago') || v.includes('paid') || v.includes('comercial')) {
    return 'De Pago';
  }
  return null;
}

function normalizeDifficulty(raw: unknown): DifficultyLevel | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Intermedio';
  const v = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (v.includes('basic') || v.includes('principiante') || v.includes('facil')) return 'Básico';
  if (v.includes('avanzad') || v.includes('expert') || v.includes('dificil')) return 'Avanzado';
  if (v.includes('intermedi') || v.includes('medio')) return 'Intermedio';
  return 'Intermedio';
}

function normalizeCaseStatus(raw: unknown): CaseStatus | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (v.includes('resuelto')) return 'Resuelto';
  if (v.includes('pendiente')) return 'Pendiente';
  return null;
}

export function normalizeEntryForFirestore(
  entry: Partial<OsintEntry> & Record<string, unknown>,
  existingCreatedAt?: string
): OsintEntry {
  const nowIso = new Date().toISOString();
  const rawDate = String(entry.date || entry.fecha || nowIso).trim();
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? `${rawDate}T09:00:00Z`
    : /^\d{4}-\d{2}-\d{2}/.test(rawDate)
      ? rawDate
      : nowIso;

  const rawTitle = String(entry.title || entry.titulo || 'Sin título').trim().slice(0, 300);
  const rawSlug =
    String(entry.slug || slugify(rawTitle) || `capsula-${Date.now()}`)
      .trim()
      .slice(0, 300) || 'capsula-osint';

  // Build Markdown content if a Spanish 7-point capsule object was passed directly
  let rawContent = typeof entry.content === 'string' ? entry.content : '';
  if (!rawContent && (entry.explicacion || entry.consejo_truco_novedad)) {
    const sections: string[] = [];
    if (entry.consejo_truco_novedad) {
      sections.push(`## 1. Consejo, Truco o Novedad\n\n${String(entry.consejo_truco_novedad)}`);
    }
    if (entry.explicacion) {
      sections.push(`## 2. Explicación Técnica\n\n${String(entry.explicacion)}`);
    }
    if (entry.ejemplo_practico) {
      sections.push(`## 3. Ejemplo Práctico\n\n${String(entry.ejemplo_practico)}`);
    }
    if (entry.herramienta_o_tecnica) {
      sections.push(`## 4. Herramienta o Técnica\n\n${String(entry.herramienta_o_tecnica)}`);
    }
    if (entry.ejercicio_practico) {
      sections.push(`## 5. Ejercicio Práctico\n\n${String(entry.ejercicio_practico)}`);
    }
    if (entry.referencias) {
      const refs = Array.isArray(entry.referencias)
        ? entry.referencias.map((r) => `- ${String(r)}`).join('\n')
        : String(entry.referencias);
      sections.push(`## 6. Referencias\n\n${refs}`);
    }
    if (entry.advertencia_etica_legal) {
      sections.push(`## 7. Advertencia Ética y Legal\n\n${String(entry.advertencia_etica_legal)}`);
    }
    rawContent = sections.join('\n\n');
  }

  const rawSummary = String(
    entry.summary ||
      entry.consejo_truco_novedad ||
      rawContent.replace(/[#*`>-]/g, '').trim().slice(0, 220)
  ).slice(0, 2000);

  const dayCategory = normalizeDayCategory(
    entry.dayCategory || entry.categoria || entry.dia_semana,
    normalizedDate
  );

  const meta = (entry.metadata || {}) as Partial<OsintEntry['metadata']> & Record<string, unknown>;

  return {
    id: String(entry.id || `${normalizedDate.slice(0, 10)}-${rawSlug}`).slice(0, 128),
    title: rawTitle,
    slug: rawSlug,
    date: normalizedDate.slice(0, 64),
    dayCategory,
    tags: Array.isArray(entry.tags)
      ? entry.tags
          .map((t) => String(t).replace(/^#/, '').trim())
          .filter(Boolean)
          .slice(0, 30)
      : ['OSINT'],
    summary: rawSummary,
    content: rawContent.slice(0, 150000),
    metadata: {
      pricingModel: normalizePricingModel(meta.pricingModel),
      toolUrl: meta.toolUrl ? String(meta.toolUrl).slice(0, 2048) : null,
      osCompatibility: meta.osCompatibility ? String(meta.osCompatibility).slice(0, 500) : null,
      sourceUrl: meta.sourceUrl ? String(meta.sourceUrl).slice(0, 2048) : null,
      difficulty: normalizeDifficulty(meta.difficulty),
      caseStatus: normalizeCaseStatus(meta.caseStatus),
      toolsUsed: Array.isArray(meta.toolsUsed)
        ? meta.toolsUsed.map((t) => String(t)).slice(0, 50)
        : null,
      challengeCompleted: Boolean(meta.challengeCompleted),
      checklist: Array.isArray(meta.checklist) ? meta.checklist.slice(0, 50) : null,
    },
    isFavorite: Boolean(entry.isFavorite),
    readingTimeMinutes: Math.min(
      240,
      Math.max(1, Number(entry.readingTimeMinutes) || estimateReadingTime(rawContent || rawTitle))
    ),
    createdAt: String(existingCreatedAt || entry.createdAt || nowIso).slice(0, 64),
    updatedAt: nowIso.slice(0, 64),
  };
}

/**
 * Incremental synchronization with Firestore:
 * 1. If there is no prior sync timestamp in local cache, fetches existing entries once,
 *    stores them in cache, and starts listening only for documents with updatedAt > cursor.
 * 2. On subsequent loads, immediately serves the local cache and queries ONLY documents
 *    where `updatedAt > lastSyncedAt` (downloading only new or modified entries).
 */
export function subscribeToEntriesIncremental(
  onUpdate: (entries: OsintEntry[], stats: SyncStats) => void,
  onError?: (err: Error) => void
): () => void {
  let unsubscribeSnapshot: (() => void) | null = null;
  let cancelled = false;

  const { entries: initialCached, lastSyncedAt: initialCursor } = loadCachedEntries();
  const entriesMap = new Map<string, OsintEntry>();
  for (const item of initialCached) {
    entriesMap.set(item.id, item);
  }

  const getSortedArray = () =>
    Array.from(entriesMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const startDeltaListener = (cursorIso: string) => {
    if (cancelled) return;
    const deltaQuery = query(collection(db, 'entries'), where('updatedAt', '>', cursorIso));

    unsubscribeSnapshot = onSnapshot(
      deltaQuery,
      (snapshot) => {
        let deltaCount = 0;
        let newestTimestamp = cursorIso;

        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as OsintEntry;
          if (change.type === 'added' || change.type === 'modified') {
            entriesMap.set(data.id, data);
            deltaCount++;
            if (data.updatedAt && data.updatedAt > newestTimestamp) {
              newestTimestamp = data.updatedAt;
            }
          } else if (change.type === 'removed') {
            entriesMap.delete(data.id);
          }
        });

        const merged = getSortedArray();
        if (deltaCount > 0) {
          saveEntriesToLocalCache(merged, newestTimestamp);
        }

        onUpdate(merged, {
          fromCacheCount: initialCached.length,
          deltaDownloadedCount: deltaCount,
          lastSyncedAt: newestTimestamp,
        });
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  };

  if (initialCursor) {
    // Immediate render from local cache, then listen only for delta updates > initialCursor
    onUpdate(getSortedArray(), {
      fromCacheCount: initialCached.length,
      deltaDownloadedCount: 0,
      lastSyncedAt: initialCursor,
    });
    startDeltaListener(initialCursor);
  } else {
    // First visit (no cache cursor yet): fetch all existing documents once, cache them, then attach delta listener
    getDocs(collection(db, 'entries'))
      .then((snapshot) => {
        if (cancelled) return;
        let maxTimestamp = '';
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as OsintEntry;
          entriesMap.set(data.id, data);
          const ts = data.updatedAt || data.createdAt || '';
          if (ts > maxTimestamp) maxTimestamp = ts;
        });

        const cursor = maxTimestamp || new Date().toISOString();
        const allEntries = getSortedArray();
        saveEntriesToLocalCache(allEntries, cursor);

        onUpdate(allEntries, {
          fromCacheCount: 0,
          deltaDownloadedCount: snapshot.size,
          lastSyncedAt: cursor,
        });

        startDeltaListener(cursor);
      })
      .catch((err) => {
        if (onError) onError(err);
      });
  }

  return () => {
    cancelled = true;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

export async function saveEntryToFirestore(
  entry: OsintEntry,
  existingCreatedAt?: string
): Promise<OsintEntry> {
  const clean = normalizeEntryForFirestore(
    entry as unknown as Partial<OsintEntry> & Record<string, unknown>,
    existingCreatedAt
  );
  await setDoc(doc(db, 'entries', clean.id), clean);
  return clean;
}

export async function deleteEntryFromFirestore(entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'entries', entryId));
}

export async function batchUpsertEntriesToFirestore(
  entries: Array<Partial<OsintEntry> & Record<string, unknown>>
): Promise<OsintEntry[]> {
  const chunks: Array<Array<Partial<OsintEntry> & Record<string, unknown>>> = [];
  for (let i = 0; i < entries.length; i += 400) {
    chunks.push(entries.slice(i, i + 400));
  }

  const normalizedList: OsintEntry[] = [];
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const item of chunk) {
      const clean = normalizeEntryForFirestore(item, item.createdAt as string | undefined);
      batch.set(doc(db, 'entries', clean.id), clean);
      normalizedList.push(clean);
    }
    await batch.commit();
  }
  return normalizedList;
}
