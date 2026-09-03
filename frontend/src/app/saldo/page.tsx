import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BalancePage() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Insira um valor válido');
      setLoading(false);
      return;
    }

    // Simulate loading balance
    setTimeout(() => {
      setLoading(false);
      router.push('/');
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4 text-amber-400">
              💳 Carregar Saldo
            </h1>
            <p className="text-slate-400">Carregue saldo na sua conta para consumir</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Valor a carregar (€)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="10.00"
                required
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(value.toString())}
                  className="bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-white font-bold transition-colors"
                >
                  €{value}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'A carregar...' : 'Confirmar Carregamento'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400">
              <Link href="/" className="text-amber-400 hover:underline">
                ← Voltar ao menu
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}