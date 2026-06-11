import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: './',
  base: './',
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
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Caches all build files including audio assets for offline mobile gameplay
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,wav}']
      },
      manifest: {
        name: 'Critical Charge',
        short_name: 'CritCharge',
        description: 'Avoid the chargers and survive as long as possible!',
        theme_color: '#222222',
        background_color: '#222222',
        display: 'standalone',   // Hides the safari browser UI on iOS & Chrome UI on Android
        orientation: 'portrait',  // Forces portrait orientation on mobile devices
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});