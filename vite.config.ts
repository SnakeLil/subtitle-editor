import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      include: ['*.ts', '*.tsx', 'lib/**/*', 'utils/**/*', 'components/**/*'],
      exclude: ['node_modules', 'dist'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'SubtitleEditor',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@mui\//,
        'lodash',
        /^lodash\//,
        'wfplayer',
        'duration-time-conversion',
        'react-textarea-autosize',
        'react-virtualized',
        'jszip',
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
        '@forlagshuset/simple-fs',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: () => 'style.css',
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2020',
  },
  // Dev server configuration for demo page
  server: {
    port: 3000,
    open: true,
  },
  // Resolve alias for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  // Optimize dependencies for dev mode
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      'lodash/isEqual',
      'duration-time-conversion',
      'wfplayer',
      'react-textarea-autosize',
      'react-virtualized',
    ],
  },
});
