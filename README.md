# OSINT Daily Knowledge Base

Aplicación web desarrollada en **React + TypeScript + Vite + Tailwind CSS + Firebase Firestore** diseñada para almacenar, organizar, indexar y consultar las cápsulas diarias de aprendizaje sobre Inteligencia de Fuentes Abiertas (OSINT) generadas por Gemini.

## Características Principales

- **Taxonomía Semanal Automática:**
  - **Lunes (`#Técnica`):** Fundamentos, metodología y análisis (con filtro por dificultad).
  - **Martes (`#Herramienta`):** Análisis de herramientas OSINT con modelo de licencia (`Gratuita`, `Freemium`, `De Pago`), URL oficial y compatibilidad de SO.
  - **Miércoles (`#CasoPráctico`):** Ejercicios guiados de verificación digital (`Resuelto` / `Pendiente`) y stack utilizado.
  - **Jueves (`#Novedad`):** Actualidad, cambios en APIs y tendencias con enlace directo a la fuente original.
  - **Viernes (`#RetoSemanal`):** Síntesis semanal con **temporizador integrado de 15 minutos** y checklist interactiva de resolución.
- **Experiencia de Lectura Ultralimpia:**
  - Diseño minimalista con tipografía `Plus Jakarta Sans` y `JetBrains Mono`.
  - Modo Claro / Oscuro adaptable al sistema sin destellos (FOUC).
  - **Tabla de Contenidos (TOC) Automática** lateral generada a partir de encabezados `H2` y `H3` con seguimiento activo al hacer scroll.
  - **Copiado Rápido en 1 clic** para todos los bloques de código, comandos CLI y *Google Dorks*.
- **Buscador Avanzado e Índices Especializados:**
  - **Command Palette (`Ctrl + K` / `Cmd + K`)** con búsqueda difusa instantánea (`fuse.js`).
  - **Feed Cronológico** con filtros combinables (día, sub-filtro de licencia en martes, etiquetas temáticas y favoritos).
  - **Caja de Herramientas:** Directorio exclusivo en cuadrícula para las herramientas de los martes.
  - **Glosario / Wiki:** Índice alfabético (`A–Z`) de técnicas de los lunes.
- **Panel de Administración Privado (CMS Integrado):**
  - Lectura pública en la web y escritura privada restringida mediante **Firebase Authentication** + **Firestore Security Rules** (`alvarogarciamoreau@gmail.com`).
  - Editor Markdown en pantalla dividida (*Split-screen*) con previsualización en tiempo real y auto-extracción de título/resumen al pegar desde Gemini.
  - Exportación e importación de copias de seguridad en `.json` y lote `.md`.

## Desarrollo Local

```bash
npm install
npm run dev
```

## Despliegue en Firebase

```bash
npm run build
npx -y firebase-tools@latest deploy
```
