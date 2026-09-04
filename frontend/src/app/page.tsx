'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Pedido {
  id: string;
  status: string;
  total: number;
  createdAt: string;
}

interface Estatisticas {
  recebidos: number;
  emPreparacao: number;
  prontos: number;
  total: number;
}

export default function HomePage() {
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    recebidos: 0,
    emPreparacao: 0,
    prontos: 0,
    total: 0,
  });

  useEffect(() => {
    fetchEstatisticas();
    const interval = setInterval(fetchEstatisticas, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchEstatisticas = async () => {
    try {
      const response = await fetch('/api/reports/estatisticas');
      const data = await response.json();
      setEstatisticas(data);
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
    }
  };

  return (
    <>
      <title>SenhasFestas - Gestão de Pedidos</title>

      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 text-amber-400">
              🍷 SenhasFestas
            </h1>
            <p className="text-xl text-slate-300">
              Sistema de gestão de pedidos para festas de aldeia - v1.1
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link href="/pedidos" className="block">
              <div className="bg-slate-800 rounded-xl p-8 hover:bg-slate-700 transition-colors border-2 border-slate-600 hover:border-amber-400">
                <div className="text-4xl mb-4">📋</div>
                <h2 className="text-2xl font-bold mb-2">Pedidos</h2>
                <p className="text-slate-400">Criar e gerir pedidos</p>
                <div className="mt-4 text-3xl font-bold text-amber-400">
                  {estatisticas.total}
                </div>
              </div>
            </Link>

            <Link href="/cozinha" className="block">
              <div className="bg-slate-800 rounded-xl p-8 hover:bg-slate-700 transition-colors border-2 border-slate-600 hover:border-green-400">
                <div className="text-4xl mb-4">👨‍🍳</div>
                <h2 className="text-2xl font-bold mb-2">Cozinha/KDS</h2>
                <p className="text-slate-400">Preparação de pedidos</p>
                <div className="mt-4 text-3xl font-bold text-green-400">
                  {estatisticas.emPreparacao}
                </div>
              </div>
            </Link>

            <Link href="/publico" className="block">
              <div className="bg-slate-800 rounded-xl p-8 hover:bg-slate-700 transition-colors border-2 border-slate-600 hover:border-blue-400">
                <div className="text-4xl mb-4">📺</div>
                <h2 className="text-2xl font-bold mb-2">Ecrã Público</h2>
                <p className="text-slate-400">Visualização para clientes</p>
                <div className="mt-4 text-3xl font-bold text-blue-400">
                  {estatisticas.prontos}
                </div>
              </div>
            </Link>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-12">
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-slate-400 text-sm">Recebidos</div>
              <div className="text-3xl font-bold text-yellow-400">
                {estatisticas.recebidos}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-slate-400 text-sm">A Preparar</div>
              <div className="text-3xl font-bold text-orange-400">
                {estatisticas.emPreparacao}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-slate-400 text-sm">Prontos</div>
              <div className="text-3xl font-bold text-green-400">
                {estatisticas.prontos}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-slate-400 text-sm">Total</div>
              <div className="text-3xl font-bold text-amber-400">
                {estatisticas.total}
              </div>
            </div>
          </div>

          <footer className="text-center text-slate-500 text-sm">
            <p>SenhasFestas v1.0 - Sistema de Gestão de Pedidos</p>
            <p className="mt-2">
              <Link href="/admin" className="text-amber-400 hover:underline">
                Admin
              </Link>
              {' • '}
              <Link href="/relatorios" className="text-amber-400 hover:underline">
                Relatórios
              </Link>
              {' • '}
              <Link href="/caixa" className="text-amber-400 hover:underline">
                Caixa
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
