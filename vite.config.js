import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api/groq': { target: 'https://api.groq.com', changeOrigin: true, rewrite: () => '/openai/v1/chat/completions' },
  '/api/deepseek': { target: 'https://api.deepseek.com', changeOrigin: true, rewrite: () => '/chat/completions' },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
