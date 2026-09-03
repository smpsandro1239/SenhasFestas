import { NextPage } from 'next';
import Head from 'next/head';

export default function PedidosPage() {
  return (
    <>
      <Head>
        <title>Pedidos - SenhasFestas</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-amber-400">
            📋 Gestão de Pedidos
          </h1>

          <div className="bg-slate-800 rounded-xl p-6">
            <p className="text-slate-300 text-lg">
              Interface de gestão de pedidos do operador.
            </p>
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-amber-400 font-bold">Pedido Novo</div>
                <div className="text-slate-400">Criar pedido manual ou por QR</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-green-400 font-bold">Cozinha</div>
                <div className="text-slate-400">Ver pedidos a preparar</div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="text-blue-400 font-bold">Ecrã Público</div>
                <div className="text-slate-400">Mostrar estado aos clientes</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
