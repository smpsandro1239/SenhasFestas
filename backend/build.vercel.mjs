import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(backendRoot, '..');
const funcDir = path.join(root, '.vercel', 'output', 'functions', 'api', 'index.js.func');
const outputDir = path.join(root, '.vercel', 'output');
const depsDir = path.join(tmpdir(), 'sf-vercel-func-dep');

rmSync(outputDir, { recursive: true, force: true });
rmSync(depsDir, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });
mkdirSync(depsDir, { recursive: true });
writeFileSync(path.join(depsDir, 'package.json'), '{}');

execSync('npx nest build', { stdio: 'inherit', cwd: backendRoot });

await build({
  entryPoints: [path.join(backendRoot, 'dist', 'serverless.main.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['@nestjs/microservices'],
  define: { 'import.meta.url': '"/workspace/bundle.js"' },
  outfile: path.join(funcDir, 'index.js'),
});

execSync('npm install pg@^8.23.0 --no-audit --no-fund --omit=dev --legacy-peer-deps', {
  stdio: 'ignore',
  cwd: depsDir,
});
cpSync(path.join(depsDir, 'node_modules'), path.join(funcDir, 'node_modules'), { recursive: true });

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
      routes: [{ handle: 'filesystem' }, { src: '/api/(.*)', dest: '/api/index.js' }],
    },
    null,
    2,
  ),
);

console.log('Build Output API escrita em .vercel/output');