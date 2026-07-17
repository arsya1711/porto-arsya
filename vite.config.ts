import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('@supabase') >= 0) return 'supabase'
          if (id.indexOf('lucide-react') >= 0) return 'icons'
          if (id.indexOf('react') >= 0) return 'react'
        },
      },
    },
  },
})
