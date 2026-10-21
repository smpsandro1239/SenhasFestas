// Valida a integridade dos documentos do projecto.
//
// Porque: a divergência de uma tabela Markdown não dá erro em lado nenhum —
// o ficheiro fica sintaticamente válido e o `grep` de headings não a apanha.
// Duas linhas com a mesma chave (dívida #13, item T5) fazem o documento
// contradizer-se sem qualquer sinal.
//
// Regras:
// - PLAN.md: chaves únicas na tabela de "Dívida técnica registada" (1.ª coluna).
// - TODO.md: chaves únicas na tabela de itens (2.ª coluna, o nome do item).
// - PROGRESS.md: headings `## ` únicos (duplicados apagam-se a si mesmos no
//   markdown, e foi isso que aconteceu numa sessão anterior).
const { readFileSync } = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');

function ler(nome) {
  return readFileSync(path.join(raiz, nome), 'utf8');
}

function celulas(linha) {
  return linha
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

function linhasTabela(md) {
  return md
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
}

function tabelaDaSecao(md, titulo) {
  const linhas = md.split('\n');
  const inicio = linhas.findIndex((l) => l.trim() === `## ${titulo}`);
  if (inicio === -1) {
    return null;
  }
  const fim = linhas.findIndex((l, i) => i > inicio && l.startsWith('## '));
  return linhas.slice(inicio, fim === -1 ? linhas.length : fim);
}

function duplicados(chaves) {
  const vistas = new Map();
  const dups = [];
  for (const chave of chaves) {
    if (!chave) {
      continue;
    }
    if (vistas.has(chave)) {
      dups.push(chave);
    } else {
      vistas.set(chave, true);
    }
  }
  return [...new Set(dups)];
}

const problemas = [];

// PLAN.md — tabela de dívida técnica (1.ª coluna = número da dívida).
const plano = ler('PLAN.md');
const secaoDivida = tabelaDaSecao(plano, 'Dívida técnica registada');
if (!secaoDivida) {
  problemas.push('PLAN.md: secção "Dívida técnica registada" não encontrada');
} else {
  const chaves = linhasTabela(secaoDivida.join('\n'))
    .map(celulas)
    .filter((c) => c.length >= 2 && /^\d+$/.test(c[0]))
    .map((c) => c[0]);
  for (const dup of duplicados(chaves)) {
    problemas.push(`PLAN.md: dívida #${dup} repetida na tabela "Dívida técnica registada"`);
  }
}

// TODO.md — tabela de itens (2.ª coluna = nome do item).
const todo = ler('TODO.md');
const itens = linhasTabela(todo)
  .map(celulas)
  .filter((c) => c.length >= 3 && c[0] !== 'Estado' && !/^-+$/.test(c[1]))
  .map((c) => c[1]);
for (const dup of duplicados(itens)) {
  problemas.push(`TODO.md: item "${dup}" repetido na tabela`);
}

// PROGRESS.md — headings únicos.
const progresso = ler('PROGRESS.md');
for (const dup of duplicados(progresso.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()))) {
  problemas.push(`PROGRESS.md: heading "## ${dup}" repetido`);
}

if (problemas.length > 0) {
  console.error('Documentos inconsistentes:');
  for (const p of problemas) {
    console.error(`  - ${p}`);
  }
  process.exit(1);
}

console.log('Documentos consistentes (PLAN.md, TODO.md, PROGRESS.md).');
