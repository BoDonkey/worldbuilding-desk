import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Test the rules engine's source, not a possibly stale dist build.
      '@worldbuilding-desk/rules-engine': path.resolve(
        import.meta.dirname,
        '../../packages/rules-engine/src/index.ts'
      )
    }
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup.ts']
        }
      }
    ]
  }
});
