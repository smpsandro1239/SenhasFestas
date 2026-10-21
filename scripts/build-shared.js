// Constrói o pacote partilhado (@senhasfestas/shared) depois da instalação.
//
// Motivo: o backend e o frontend importam o pacote pelo nome e o npm resolve
// esse nome para packages/shared/dist. Num clone novo o dist não existe, e o
// require falha com MODULE_NOT_FOUND. O postinstall garante que o dist existe
// sempre que há compilador disponível.
//
// Em instalações de produção (--omit=dev) não há TypeScript: o runtime recebe
// o dist já compilado do builder, por isso o script sai sem erro.
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const dist = path.join(raiz, 'packages', 'shared', 'dist', 'index.js');
const tsc = path.join(raiz, 'node_modules', 'typescript', 'bin', 'tsc');

if (existsSync(dist)) {
  process.exit(0);
}

if (!existsSync(tsc)) {
  console.log('[shared] TypeScript indisponível — dist não compilado (instalação sem devDependencies).');
  process.exit(0);
}

execFileSync(process.execPath, [tsc, '-p', path.join(raiz, 'packages', 'shared', 'tsconfig.json')], {
  stdio: 'inherit',
});
