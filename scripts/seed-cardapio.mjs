import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function carregarEnv() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  const texto = fs.readFileSync(envPath, 'utf8');
  const vars = {};
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

const env = carregarEnv();
const EVENT_ID = process.env.EVENT_ID;

const CARDAPIO = [
  {
    categoria: 'Comidas',
    itens: [
      { nome: 'Moelas Fritas', descricao: 'Moelas estufadas com molho', preco: 5.0, stock: 40 },
      { nome: 'Bifana', descricao: 'Bifana tradicional com molho', preco: 5.0, stock: 60 },
      { nome: 'Cachorro Quente', descricao: 'Salsicha, molho e batata palha', preco: 4.5, stock: 50 },
      { nome: 'Hamburger Artesanal', descricao: 'Hamburger caseiro com queijo', preco: 6.5, stock: 40 },
      { nome: 'Cheeseburger', descricao: 'Hamburger simples com queijo', preco: 5.5, stock: 40 },
      { nome: 'Prego no Pão', descricao: 'Prego com molho', preco: 5.5, stock: 40 },
      { nome: 'Francesinha de Frango', descricao: 'Francesinha caseira de frango', preco: 6.0, stock: 30 },
      { nome: 'Rissóis de Camarão (3un)', descricao: 'Rissóis fritos', preco: 4.0, stock: 50 },
      { nome: 'Bolinhos de Bacalhau (3un)', descricao: 'Bolinhos de bacalhau fritos', preco: 4.0, stock: 50 },
      { nome: 'Pão com Chouriço', descricao: 'Pão com chouriço grelhado', preco: 3.0, stock: 50 },
      { nome: 'Tosta Mista', descricao: 'Tosta de presunto e queijo', preco: 3.5, stock: 40 },
      { nome: 'Batatas Fritas', descricao: 'Porção de batatas fritas', preco: 2.5, stock: 60 },
    ],
  },
  {
    categoria: 'Bebidas sem Álcool',
    itens: [
      { nome: 'Água 50cl', descricao: 'Água mineral 50cl', preco: 1.5, stock: 200 },
      { nome: 'Água com Gás 33cl', descricao: 'Água com gás 33cl', preco: 1.5, stock: 100 },
      { nome: 'Refrigerante (lata) 33cl', descricao: 'Lata de refrigerante', preco: 2.0, stock: 150 },
      { nome: 'Sumo de Laranja Natural 25cl', descricao: 'Sumo de laranja espremido na hora', preco: 2.5, stock: 60 },
      { nome: 'Sumo de Maçã 25cl', descricao: 'Sumo de maçã embalado', preco: 2.0, stock: 60 },
      { nome: 'Ice Tea Limão 33cl', descricao: 'Chá gelado de limão', preco: 2.5, stock: 80 },
      { nome: 'Sumo 1L (garrafa)', descricao: 'Garrafa de sumo 1L', preco: 4.0, stock: 40 },
      { nome: 'Café', descricao: 'Café espresso', preco: 1.2, stock: 100 },
    ],
  },
  {
    categoria: 'Bebidas Alcoólicas',
    itens: [
      { nome: 'Cerveja 33cl', descricao: 'Cerveja imperial 33cl', preco: 3.0, stock: 150 },
      { nome: 'Cerveja 50cl', descricao: 'Cerveja 50cl', preco: 3.5, stock: 150 },
      { nome: 'Vinho Verde (copo)', descricao: 'Copo de vinho verde', preco: 2.5, stock: 80 },
      { nome: 'Vinho Tinto (copo)', descricao: 'Copo de vinho tinto', preco: 2.5, stock: 80 },
      { nome: 'Sangria 25cl', descricao: 'Sangria tradicional 25cl', preco: 4.0, stock: 50 },
      { nome: 'Ginjinha 5cl', descricao: 'Ginjinha tradicional', preco: 1.5, stock: 80 },
      { nome: 'Gin Tónica', descricao: 'Gin com tónica e limão', preco: 6.0, stock: 40 },
      { nome: 'Rum + Cola', descricao: 'Rum com cola', preco: 5.0, stock: 40 },
      { nome: 'Whisky 4cl', descricao: 'Whisky puro ou com gelo', preco: 5.0, stock: 40 },
      { nome: 'Vodka + Sumo', descricao: 'Vodka com sumo', preco: 5.0, stock: 40 },
    ],
  },
  {
    categoria: 'Sobremesas',
    itens: [
      { nome: 'Baba de Camelo', descricao: 'Baba de camelo tradicional', preco: 3.0, stock: 30 },
      { nome: 'Mousse de Chocolate', descricao: 'Mousse de chocolate caseira', preco: 3.0, stock: 30 },
      { nome: 'Fruta da Época', descricao: 'Seleção de fruta da época', preco: 2.0, stock: 40 },
    ],
  },
];

async function main() {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  let eventoId = EVENT_ID;
  if (!eventoId) {
    const { rows } = await client.query('SELECT id, name FROM events ORDER BY "createdAt" DESC LIMIT 1');
    if (rows.length === 0) {
      console.error('Sem eventos na base; passe EVENT_ID=uuid');
      await client.end();
      process.exit(1);
    }
    eventoId = rows[0].id;
    console.log(`Evento: ${rows[0].name} (${eventoId})`);
  }

  const existentesCat = await client.query('SELECT name, id FROM categories WHERE "eventId" = $1', [eventoId]);
  const catPorNome = new Map(existentesCat.rows.map((r) => [r.name, r.id]));

  const existentesProd = await client.query('SELECT name FROM products WHERE "eventId" = $1', [eventoId]);
  const prodExistentes = new Set(existentesProd.rows.map((r) => r.name));

  let criadas = 0;
  let inseridos = 0;
  let ignorados = 0;

  for (const grupo of CARDAPIO) {
    let catId = catPorNome.get(grupo.categoria);
    if (!catId) {
      const ins = await client.query(
        'INSERT INTO categories (id, name, description, "sortOrder", "isActive", "createdAt", "updatedAt", "eventId") VALUES (gen_random_uuid(), $1, $2, $3, true, now(), now(), $4) RETURNING id',
        [grupo.categoria, `Categoria ${grupo.categoria.toLowerCase()}`, 0, eventoId],
      );
      catId = ins.rows[0].id;
      catPorNome.set(grupo.categoria, catId);
      criadas++;
    }

    for (const item of grupo.itens) {
      if (prodExistentes.has(item.nome)) {
        ignorados++;
        continue;
      }
      await client.query(
        `INSERT INTO products (id, name, description, price, availability, stock, "isActive", options, modifiers, "kitchenName", "createdAt", "updatedAt", "eventId", "categoryId")
         VALUES (gen_random_uuid(), $1, $2, $3, 'available', $4, true, NULL, NULL, $5, now(), now(), $6, $7)`,
        [item.nome, item.descricao, item.preco, item.stock, item.nome.includes('Bifana') ? 'Bifanas' : item.nome, eventoId, catId],
      );
      inseridos++;
    }
  }

  console.log(`Cardápio: ${criadas} categorias criadas, ${inseridos} produtos inseridos, ${ignorados} já existentes (saltados).`);
  await client.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});