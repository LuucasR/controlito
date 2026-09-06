import { resolve } from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    // Los e2e cruzan a una base remota y argon2 es lento a proposito (es lo que
    // lo hace resistente a fuerza bruta). 5s por defecto no alcanza.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  // esbuild (el transpilador por defecto de Vitest) no soporta emitDecoratorMetadata,
  // sin el cual la inyección de dependencias de Nest no funciona en los tests.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
