import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const funcDir = path.join(root, '.vercel', 'output', 'functions', 'api', 'index.js.func');
const outputDir = path.join(root, '.vercel', 'output');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

execSync('npx nest build', { stdio: 'inherit', cwd: root });

await build({
  entryPoints: [path.join(root, 'dist', 'serverless.main.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['@nestjs/microservices'],
  define: { 'import.meta.url': '"/workspace/bundle.js"' },
  outfile: path.join(funcDir, 'index.js'),
});

writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs20.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      maxDuration: 30,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/api/index' }],
    },
    null,
    2,
  ),
);

console.log('Build Output API escrita em .vercel/output');