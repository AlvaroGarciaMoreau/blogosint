# Especificación Técnica y Funcional: OSINT Daily Knowledge Base

## 1. Visión General del Proyecto
**OSINT Daily Knowledge Base** es una aplicación web desarrollada en React diseñada para almacenar, organizar, indexar y consultar las cápsulas diarias de aprendizaje sobre Inteligencia de Fuentes Abiertas (OSINT) generadas por Gemini. 

El objetivo principal es ofrecer una experiencia de lectura ultralimpia, una búsqueda instantánea cuando se necesite recordar una técnica o herramienta específica durante una investigación, y un panel de administración ágil para volcar el contenido diario en segundos.

---

## 2. Estructura de Contenido (Taxonomía Semanal)
El sistema organizará automáticamente las entradas según la programación semanal definida, asignando colores, iconos y metadatos específicos a cada categoría:

1. **Lunes — Fundamentos y Técnicas (`#Técnica`)**
   * *Contenido:* Conceptos de investigación, metodología y análisis.
   * *Atributos extra:* Nivel de dificultad (Básico, Intermedio, Avanzado).
2. **Martes — Herramientas OSINT (`#Herramienta`)**
   * *Contenido:* Análisis profundo de software, scripts o plataformas.
   * *Atributos extra (Obligatorios):* Modelo de licencia (`Gratuita`, `Freemium`, `De Pago`), URL oficial, SO compatible / Web.
3. **Miércoles — Casos Prácticos (`#CasoPráctico`)**
   * *Contenido:* Ejercicios guiados de verificación digital (Geolocalización, Cronolocalización, Sock Puppets, etc.).
   * *Atributos extra:* Estado (`Resuelto`, `Pendiente`), Herramientas utilizadas.
4. **Jueves — Actualidad y Tendencias (`#Novedad`)**
   * *Contenido:* Noticias del sector, cambios en APIs, nuevas regulaciones o técnicas emergentes.
   * *Atributos extra (Obligatorio):* Enlace a la fuente original.
5. **Viernes — Resumen y Reto Express (`#RetoSemanal`)**
   * *Contenido:* Síntesis de la semana y reto práctico de < 15 minutos.
   * *Atributos extra:* Temporizador integrado (15 min) o checklist de resolución.

---

## 3. Características Principales (Funcionalidades)

### 3.1. Experiencia de Lectura y Diseño (UI/UX)
* **Diseño Minimalista:** Inspirado en plataformas de documentación técnica (como GitBook, Notion o Obsidian Publish). Tipografía sin serifa para la interfaz (`Inter` o `Plus Jakarta Sans`) y monoespaciada para bloques de código, *dorks* o comandos (`JetBrains Mono` o `Fira Code`).
* **Modo Claro / Oscuro:** Esencial para largas sesiones de lectura o investigación nocturna.
* **Tabla de Contenidos (TOC) Automática:** En la vista de lectura de cada artículo, un índice lateral derecho generado automáticamente a partir de los encabezados (`H2`, `H3`) del texto en Markdown, con resaltado de la sección activa al hacer scroll.
* **Botón de Copiado Rápido:** Todos los bloques de código, comandos de terminal o *Google Dorks* tendrán un botón "Copiar al portapapeles" en un clic.

### 3.2. Buscador Avanzado e Índices
* **Búsqueda Instantánea (Command Palette `Ctrl + K` / `Cmd + K`):** Buscador en tiempo real que indexa títulos, cuerpo del mensaje y etiquetas.
* **Filtros Combinables:**
  * Por día de la semana / Categoría (Lunes a Viernes).
  * En caso de filtrar por **Herramientas (Martes)**, sub-filtro rápido por licencia: `Gratuita`, `Freemium`, `De Pago`.
  * Por etiquetas temáticas (ej. `#Geolocalización`, `#RedesSociales`, `#Dominios`, `#Cripto`, `#BrechasDeDatos`).
* **Vistas de Índice Especializadas:**
  * **Vista Cronológica (Feed):** Las cápsulas diarias ordenadas de más reciente a más antigua.
  * **Directorio de Herramientas:** Una vista en cuadrícula (Grid) exclusiva para recopilar todas las herramientas de los martes con acceso directo a sus enlaces y filtro de precio.
  * **Glosario / Wiki:** Índice alfabético de técnicas y conceptos aprendidos los lunes.

### 3.3. Panel de Administración (CMS Integrado)
* **Acceso Rápido:** Vista protegida (o conmutable en entorno local) para añadir y editar entradas.
* **Flujo "Copiar y Pegar desde Gemini":**
  * Editor Markdown con vista previa en tiempo real (Split-screen).
  * Detección automática del día de la semana según la fecha actual para pre-seleccionar la categoría correspondiente (Lunes = Técnica, Martes = Herramienta, etc.).
* **Campos Dinámicos del Formulario:**
  * Título de la cápsula.
  * Fecha de publicación.
  * Selector de Categoría (Lunes a Viernes).
  * *Campos condicionales:* Si es Martes, muestra el selector `Gratuita | Freemium | De Pago` y campo `URL de la herramienta`. Si es Jueves, muestra el campo `URL Fuente Original`.
  * Selector/creador de Etiquetas (Tags).
  * Área de texto Markdown para pegar la respuesta de Gemini.
* **Gestión de Datos (Backup & Portabilidad):**
  * Botón para **Exportar** toda la base de datos a un archivo `.json` o lote de archivos `.md` (para que nunca pierdas tus apuntes).
  * Botón para **Importar** copias de seguridad.

---

## 4. Modelo de Datos (JSON Schema)

Cada entrada del blog seguirá esta estructura de datos:

```json
{
  "id": "uuid-v4-string",
  "title": "Análisis de Maltego: Mapeo de infraestructuras y relaciones",
  "slug": "analisis-de-maltego-mapeo-infraestructuras",
  "date": "2026-11-10T09:00:00Z",
  "dayCategory": "MARTES_HERRAMIENTA", 
  "tags": ["Infraestructura", "Grafos", "Reconocimiento", "Personas"],
  "summary": "Cómo utilizar las transformaciones básicas de Maltego para conectar alias con correos electrónicos y dominios.",
  "content": "## ¿Qué es Maltego?\nMaltego es una herramienta...",
  "metadata": {
    "pricingModel": "Freemium",
    "toolUrl": "https://www.maltego.com",
    "sourceUrl": null,
    "difficulty": "Intermedio",
    "challengeCompleted": false
  },
  "isFavorite": true,
  "readingTimeMinutes": 4
}
```

---

## 5. Arquitectura y Stack Tecnológico Recomendado

* **Frontend Framework:** React 18+ (con Vite o Next.js).
* **Estilos:** Tailwind CSS (con el plugin `@tailwindcss/typography` para formatear automáticamente el Markdown de Gemini con una estética de lectura impecable).
* **Iconografía:** `lucide-react` (iconos limpios y técnicos).
* **Renderizado de Markdown:** `react-markdown` + `remark-gfm` (para tablas y listas de tareas) + `rehype-highlight` (resaltado de sintaxis en bloques de código).
* **Búsqueda Local Difusa (Fuzzy Search):** `fuse.js` (permite encontrar resultados aunque escribas con pequeñas faltas de ortografía).
* **Persistencia de Datos:**
  1. Firebase Firestore para acceder a tus apuntes tanto desde el móvil (donde recibes la notificación de Gemini) como desde el PC.

---

## 6. Hoja de Ruta de Desarrollo (Paso a Paso)

1. **Fase 1: Esqueleto y Lector (MVP):**
   * Crear la interfaz principal con barra lateral de navegación, buscador superior y listado de entradas con datos de ejemplo de una semana completa de OSINT.
   * Implementar la vista de lectura con generación automática de Índice (TOC) y soporte Markdown.
2. **Fase 2: Buscador y Directorio de Herramientas:**
   * Configurar el filtrado instantáneo por texto, etiquetas, día de la semana y modelo de pago (Gratuita/Freemium/Pago).
   * Crear la pestaña exclusiva "Caja de Herramientas" (recopilatorio de los martes).
3. **Fase 3: Panel de Administración:**
   * Construir el formulario inteligente para pegar la cápsula diaria de Gemini, previsualizarla y guardarla, junto con el sistema de copias de seguridad (Exportar/Importar JSON).