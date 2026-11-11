export type DayCategory =
  | 'LUNES_TECNICA'
  | 'MARTES_HERRAMIENTA'
  | 'MIERCOLES_CASO'
  | 'JUEVES_NOVEDAD'
  | 'VIERNES_RETO';

export type PricingModel = 'Gratuita' | 'Freemium' | 'De Pago';
export type DifficultyLevel = 'Básico' | 'Intermedio' | 'Avanzado';
export type CaseStatus = 'Resuelto' | 'Pendiente';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface OsintMetadata {
  pricingModel: PricingModel | null;
  toolUrl: string | null;
  osCompatibility?: string | null;
  sourceUrl: string | null;
  difficulty: DifficultyLevel | null;
  caseStatus?: CaseStatus | null;
  toolsUsed?: string[] | null;
  challengeCompleted: boolean;
  checklist?: ChecklistItem[] | null;
}

export interface OsintEntry {
  id: string;
  title: string;
  slug: string;
  date: string;
  dayCategory: DayCategory;
  tags: string[];
  summary: string;
  content: string;
  metadata: OsintMetadata;
  isFavorite: boolean;
  readingTimeMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ActiveView = 'feed' | 'article' | 'tools' | 'wiki' | 'admin';

export interface CategoryInfo {
  id: DayCategory;
  dayName: string;
  shortTitle: string;
  fullTitle: string;
  hashtag: string;
  description: string;
  badgeClasses: string;
  dotColor: string;
  borderAccent: string;
}

export const CATEGORY_CONFIG: Record<DayCategory, CategoryInfo> = {
  LUNES_TECNICA: {
    id: 'LUNES_TECNICA',
    dayName: 'Lunes',
    shortTitle: 'Fundamentos y Técnicas',
    fullTitle: 'Lunes — Fundamentos y Técnicas',
    hashtag: '#Técnica',
    description: 'Conceptos de investigación, metodología y análisis OSINT.',
    badgeClasses:
      'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
    dotColor: 'bg-sky-500',
    borderAccent: 'border-l-sky-500',
  },
  MARTES_HERRAMIENTA: {
    id: 'MARTES_HERRAMIENTA',
    dayName: 'Martes',
    shortTitle: 'Herramientas OSINT',
    fullTitle: 'Martes — Herramientas OSINT',
    hashtag: '#Herramienta',
    description: 'Análisis profundo de software, scripts o plataformas.',
    badgeClasses:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    dotColor: 'bg-emerald-500',
    borderAccent: 'border-l-emerald-500',
  },
  MIERCOLES_CASO: {
    id: 'MIERCOLES_CASO',
    dayName: 'Miércoles',
    shortTitle: 'Casos Prácticos',
    fullTitle: 'Miércoles — Casos Prácticos',
    hashtag: '#CasoPráctico',
    description:
      'Ejercicios guiados de verificación digital (Geolocalización, Cronolocalización, Sock Puppets).',
    badgeClasses:
      'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    dotColor: 'bg-amber-500',
    borderAccent: 'border-l-amber-500',
  },
  JUEVES_NOVEDAD: {
    id: 'JUEVES_NOVEDAD',
    dayName: 'Jueves',
    shortTitle: 'Actualidad y Tendencias',
    fullTitle: 'Jueves — Actualidad y Tendencias',
    hashtag: '#Novedad',
    description:
      'Noticias del sector, cambios en APIs, nuevas regulaciones o técnicas emergentes.',
    badgeClasses:
      'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25',
    dotColor: 'bg-violet-500',
    borderAccent: 'border-l-violet-500',
  },
  VIERNES_RETO: {
    id: 'VIERNES_RETO',
    dayName: 'Viernes',
    shortTitle: 'Resumen y Reto Express',
    fullTitle: 'Viernes — Resumen y Reto Express',
    hashtag: '#RetoSemanal',
    description: 'Síntesis de la semana y reto práctico de < 15 minutos.',
    badgeClasses:
      'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    dotColor: 'bg-rose-500',
    borderAccent: 'border-l-rose-500',
  },
};

export const ORDERED_CATEGORIES: DayCategory[] = [
  'LUNES_TECNICA',
  'MARTES_HERRAMIENTA',
  'MIERCOLES_CASO',
  'JUEVES_NOVEDAD',
  'VIERNES_RETO',
];

export function detectCategoryFromDate(dateInput?: string | Date): DayCategory {
  const d = dateInput ? new Date(dateInput) : new Date();
  const day = isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
  switch (day) {
    case 1:
      return 'LUNES_TECNICA';
    case 2:
      return 'MARTES_HERRAMIENTA';
    case 3:
      return 'MIERCOLES_CASO';
    case 4:
      return 'JUEVES_NOVEDAD';
    case 5:
    default:
      return 'VIERNES_RETO';
  }
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function estimateReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

