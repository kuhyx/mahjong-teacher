import { defineConfig } from 'vitest/config'

// Relative base so the same build works from Caddy and from a file server.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  server: { host: '127.0.0.1', port: 8798, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8797' } },
  preview: { host: '127.0.0.1', port: 8798, strictPort: true },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/engine/**', 'src/ai/**', 'src/log/**', 'services/**'] },
  },
})
