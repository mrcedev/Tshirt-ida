import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiDesignApi } from './server/aiDesignPlugin.js'

export default defineConfig(({ mode }) => {
  // Reads .env / .env.local. Only VITE_-prefixed values ever reach the browser, so the key stays on the server.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), aiDesignApi(env.ANTHROPIC_API_KEY)],
    build: {
      // The Three.js chunk (~640 kB) is only loaded when someone opens the 3D preview.
      chunkSizeWarningLimit: 700,
    },
  }
})
