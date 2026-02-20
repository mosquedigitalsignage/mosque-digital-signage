import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mosque-digital-signage/',
  server: {
    open: true,
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        landing: 'landing.html',
      },
    },
  },
});
