import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const analyze = mode === 'analyze' || process.env.ANALYZE === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      analyze
        ? visualizer({
            filename: 'dist/bundle-stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5190,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
        },
        // Backend serves stored files at /uploads/* (avatars, etc.).
        // The React app route is also /uploads — bypass proxy on reload so
        // Vite serves index.html instead of hitting the file middleware.
        '/uploads': {
          target: process.env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          bypass(req) {
            const pathname = (req.url ?? '').split('?')[0] ?? '';
            if (pathname === '/uploads' || pathname === '/uploads/') {
              return '/index.html';
            }
            const accept = req.headers.accept ?? '';
            if (accept.includes('text/html')) {
              return '/index.html';
            }
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
        ],
        thresholds: {
          // Phase 8 had no gate. Floor matches current RTL surface area
          // (Button/Input/DataTable + auth pages); raise as more pages get tests.
          lines: 12,
          functions: 10,
          branches: 10,
          statements: 12,
        },
      },
    },
  };
});
