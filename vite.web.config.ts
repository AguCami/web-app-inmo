import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * La web pública de la inmobiliaria (carpeta web/). Es un sitio aparte de la
 * app de gestión: se compila a dist-web/ y va al dominio principal. Comparte
 * el logo, la espiral y la credencial con la app, tomándolos de src/ y public/.
 *
 * Las rutas van relativas a `root` (web/).
 */
export default defineConfig({
  root: 'web',
  publicDir: '../public',
  plugins: [react()],
  base: './',
  build: { outDir: '../dist-web', emptyOutDir: true, sourcemap: false },
});
