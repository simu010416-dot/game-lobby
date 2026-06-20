import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      include: [/xiangqi\.cjs/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['@game-lobby/game-chinese-chess > ../vendor/xiangqi.cjs'],
  },
  server: {
    port: 7125,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4123',
      '/socket.io': {
        target: 'http://localhost:4123',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
