import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  build: {
    rollupOptions: {
      output: {
        // v0.304: vendor chunk 분리 · 초기 bundle 감축 + 안정 vendor 캐시
        // (route lazy chunk 는 v0.302 에서 이미 분리 → 이번 슬라이스는 vendor 만).
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-ui': ['@radix-ui/react-dialog', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
