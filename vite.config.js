import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  base: './',
  build: {
    target: ['chrome61', 'safari12'],
    cssTarget: ['chrome61', 'safari12'],
  },
})