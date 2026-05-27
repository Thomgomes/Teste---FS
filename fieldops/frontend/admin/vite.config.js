import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: true, // Necessário para o Docker expor o serviço para fora do container
    watch: {
      usePolling: true, // Garante que o hot-reload funcione atualizando o navegador no Windows/Linux com Docker
    },
  },
})
