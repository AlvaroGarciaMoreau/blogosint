import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/blogosint/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'lucide-react', 'fuse.js'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-highlight', 'highlight.js'],
        },
      },
    },
  },
});
