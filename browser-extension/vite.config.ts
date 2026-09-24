import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }
import tailwindcss from '@tailwindcss/vite'

import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        setup: resolve(import.meta.dirname, 'setup.html'),
        info: resolve(import.meta.dirname, 'info.html'),
        faq: resolve(import.meta.dirname, 'faq.html'),
      },
    },
  },
})
