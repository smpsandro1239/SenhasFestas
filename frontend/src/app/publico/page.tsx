import { NextPage } from 'next';
import Head from 'next/head';

export default function PublicoPage() {
  return (
    <>
      <Head>
        <title>Ecrã Público - SenhasFestas</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-6xl font-bold mb-8 text-center text-amber-400">
            📺 Ecrã Público
          </h1>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-3xl font-bold mb-4 text-orange-400">
                🔥 A Preparar
              </h2>
              <div className="space-y-4">
                <div className="bg-slate-700 rounded-lg p-6 text-center">
                  <div className="text-5xl font-bold">#001</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-6 text-center">
                  <div className="text-5xl font-bold">#002</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-3xl font-bold mb-4 text-green-400">
                ✅ Prontos
              </h2>
              <div className="space-y-4">
                <div className="bg-green-600 rounded-lg p-6 text-center animate-pulse">
                  <div className="text-5xl font-bold">#003</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}