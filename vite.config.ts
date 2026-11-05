import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig({
  plugins: [react()],
  // La versión que se ve en la esquina (sale de package.json) y cuándo se compiló.
  define: {
    __VERSION__: JSON.stringify(version),
    __COMPILADO__: JSON.stringify(new Date().toISOString()),
  },
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
