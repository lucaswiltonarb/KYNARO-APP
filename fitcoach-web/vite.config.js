import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'patch-fitcoach',
      transform(code, id) {
        // Patch BrowserRouter to add basename for /api/app prefix
        if (id.endsWith('App.jsx')) {
          code = code.replace('<BrowserRouter>', '<BrowserRouter basename="/api/app">');
          return code;
        }
        // Patch window.location.href redirects
        if (id.endsWith('api.js')) {
          code = code.replace("window.location.href='/login'", "window.location.href='/api/app/login'");
          return code;
        }
        // Patch mediapipe paths in poseEngine (single quotes AND backticks)
        if (id.endsWith('poseEngine.js')) {
          code = code.replaceAll("'/mediapipe/", "'/api/app/mediapipe/");
          code = code.replaceAll('`/mediapipe/', '`/api/app/mediapipe/');
          return code;
        }
        // Patch upload URLs in source files (dynamic ones from API will be handled by backend middleware)
        if (id.includes('/src/') && !id.endsWith('api.js')) {
          if (code.includes("'/uploads/") || code.includes('"/uploads/')) {
            code = code.replaceAll("'/uploads/", "'/api/uploads/");
            code = code.replaceAll('"/uploads/', '"/api/uploads/');
            return code;
          }
        }
      }
    }
  ],
  base: '/api/app/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['kynaro.preview.emergentagent.com'],
    proxy: {
      '/api': 'http://localhost:8001',
      '/uploads': 'http://localhost:8001',
    }
  }
})
