import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
execSync('node backend/build.vercel.mjs', { stdio: 'inherit', cwd: root });