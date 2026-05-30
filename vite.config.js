import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        test: 'test.html',
      }
    },
  },
  server: {
    open: true,
  },
  plugins: [
    basicSsl()
  ],
});