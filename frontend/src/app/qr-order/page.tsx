import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function QROrderPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await fetch('/api/products');
      const json = await data.json();
      setProducts(json);
    } catch (err) {
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === product.id);
      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.quantity > 1) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao carrinho');
      return;
    }

    // Simulate order creation
    setShowPaymentModal(true);
    setTimeout(() => {
      setShowPaymentModal(false);
      alert('Pedido criado com sucesso! Aguarde a preparação.');
      setCart([]);
      router.push('/');
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-amber-400">
                🍽️ Menu
              </h1>
              <p className="text-slate-400">
                Selecione os itens que deseja consumir
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-slate-700 rounded-lg p-3">
                <span className="text-sm text-slate-400">Mesa:</span>
                <span className="text-lg font-bold text-white">A05</span>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <span className="text-sm text-slate-400">Saldo:</span>
                <span className="text-lg font-bold text-green-400">€15.50</span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Carregue o QR da mesa</h2>
            <div className="bg-slate-700 rounded-lg p-8 text-center">
              <div className="mb-4">
                <svg className="w-24 h-24 mx-auto text-amber-400" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="12" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M20,20 L80,20 M20,50 L80,50 M20,80 L80,80" stroke="currentColor" stroke-width="2"/>
                  <path d="M20,20 L20,80 M50,20 L50,80 M80,20 L80,80" stroke="currentColor" stroke-width="2"/>
                </svg>
              </div>
              <p className="text-slate-400">QR Code gerado automaticamente</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4">Selecione os itens</h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full border-4 border-amber-400 border-t-transparent w-12 h-12 mx-auto"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400 text-center">
                {error}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-slate-400">
                    Nenhum produto disponível
                  </div>
                ) : (
                  products.map((product: any) => (
                    <div key={product.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-white">{product.name}</h3>
                        <span className="text-sm bg-amber-500/20 px-2 py-1 rounded text-amber-400">
                          €{product.price.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{product.description || ''}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded"
                          >
                            -
                          </button>
                          <span className="whitespace-nowrap">
                            {cart.find((item) => item.id === product.id)?.quantity || 0}
                          </span>
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-right font-mono">
                          €{(cart.find((item) => item.id === product.id)?.quantity || 0) * product.price}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pt-6 border-t border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold text-white">Total:</span>
                <span className="text-2xl font-bold text-amber-400">€{getCartTotal().toFixed(2)}</span>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={clearCart}
                  className="text-sm text-slate-400 hover:text-slate-300"
                >
                  Limpar Carrinho
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={cart.length === 0 || loading}
                  className="ml-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Fazer Pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 text-center text-green-400">
                ✅ Pedido Confirmado
              </div>
              <p className="text-center text-slate-400 mb-6">
                Seu pedido foi enviado para a cozinha!
              </p>
              <div className="space-y-4">
                {cart.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-700">
                <div className="text-xl font-bold text-white">
                  Total: €{getCartTotal().toFixed(2)}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setCart([]);
                    router.push('/');
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}