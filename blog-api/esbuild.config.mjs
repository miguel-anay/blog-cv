import { build } from 'esbuild';

await build({
  entryPoints: ['src/interfaces/lambda/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // @libsql/client usa HTTP para Turso — no necesita bindings nativos.
  // Se puede bundlear directamente. Si usás SQLite local, mové a Lambda Layer.
  minify: true,
  outfile: 'dist/handler.cjs',
  sourcemap: false,
});

console.log('Build complete: dist/handler.cjs');
