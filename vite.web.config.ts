import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { versionWeb } from './package.json';

/**
 * La web pública de la inmobiliaria (carpeta web/). Es un sitio aparte de la
 * app de gestión: se compila a dist-web/ y va al dominio principal. Comparte
 * el logo, la espiral y la credencial con la app, tomándolos de src/ y public/.
 *
 * Las rutas van relativas a `root` (web/).
 *
 * Lleva su propio número de versión, separado del de la app: `versionWeb`
 * en package.json. Se ve en la esquina, como en la app.
 */
export default defineConfig({
  root: 'web',
  publicDir: '../public',
  plugins: [react()],
  define: {
    __VERSION__: JSON.stringify(versionWeb),
    __COMPILADO__: JSON.stringify(new Date().toISOString()),
  },
  base: './',
  build: { outDir: '../dist-web', emptyOutDir: true, sourcemap: false },
});
