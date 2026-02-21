import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  envPrefix: ['VITE_', 'GEMINI_'],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    allowedHosts: true,
  },
})
