import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { PACKAGED_RENDERER_CSP } from './rendererCsp.ts';

/** Adds the packaged renderer CSP to index.html in production builds only. */
function rendererCspPlugin(): Plugin {
  return {
    name: 'renderer-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: {'http-equiv': 'Content-Security-Policy', content: PACKAGED_RENDERER_CSP},
        injectTo: 'head-prepend'
      }
    ]
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), rendererCspPlugin()],
  resolve: {
    alias: {
      '@worldbuilding-desk/rules-ui': path.resolve(import.meta.dirname, '../../packages/rules-ui/src/index.ts'),
      '@rules-ui': path.resolve(import.meta.dirname, '../../packages/rules-ui/src'),
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(import.meta.dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(import.meta.dirname, 'node_modules/react/jsx-dev-runtime.js'),
    }
  }
})
