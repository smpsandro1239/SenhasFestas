import { NextPage } from 'next';
import Head from 'next/head';

export default function CozinhaPage() {
  return (
    <>
      <Head>
        <title>Cozinha/KDS - SenhasFestas</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-green-400">
            👨‍🍳 Cozinha / KDS
          </h1>

          <div className="bg-slate-800 rounded-xl p-6">
            <p className="text-slate-300 text-lg">
              Ecrã de preparação de pedidos em tempo real.
            </p>
            <div className="mt-6 space-y-4">
              <div className="bg-slate-700 rounded-lg p-4 border-l-4 border-yellow-400">
                <div className="flex justify-between">
                  <span className="font-bold">Pedido #001</span>
                  <span className="text-yellow-400">Recebido</span>
                </div>
                <div className="mt-2 text-slate-400">
                  2x Cerveja Artesanal • 1x Caldo Verde
                </div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4 border-l-4 border-orange-400">
                <div className="flex justify-between">
                  <span className="font-bold">Pedido #002</span>
                  <span className="text-orange-400">A Preparar</span>
                </div>
                <div className="mt-2 text-slate-400">
                  1x Bifana • 1x Batatas Fritas
                </div>
              </div>
              <div className="bg-slate-700 rounded-lg p-4 border-l-4 border-green-400">
                <div className="flex justify-between">
                  <span className="font-bold">Pedido #003</span>
                  <span className="text-green-400">Pronto</span>
                </div>
                <div className="mt-2 text-slate-400">
                  3x Água • 2x Refrigerante
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}