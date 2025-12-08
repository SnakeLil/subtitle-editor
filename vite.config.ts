import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
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
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || '';
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2020',
  },
});
