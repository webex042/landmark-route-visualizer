import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

/* Produces ONE self-contained index.html — all JavaScript, CSS and fonts
 * inlined — that opens by double-clicking, with no server, no install and no
 * internet connection. Intended for the project demonstration. */
export default defineConfig({
  resolve: {
    alias: {
      'lucide-react': path.resolve(import.meta.dirname, 'node_modules/lucide-react/dist/cjs/lucide-react.js'),
    },
  },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
