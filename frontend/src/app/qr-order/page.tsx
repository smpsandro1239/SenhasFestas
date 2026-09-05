'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { MinusIcon, PlusIcon, QrIcon, ArrowLeftIcon, CheckIcon } from '@/components/ui/icons';

const TABLE_NUMBER = 'A05';
const BALANCE = 15.5;

export default function QROrderPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await fetch('/api/products');
      const json = await data.json();
      setProducts(json);
    } catch {
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
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.quantity > 1) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao carrinho');
      return;
    }
    setShowPaymentModal(true);
  };

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface-solid/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex-1 text-center">
              <h1 className="font-bold text-zinc-50 tracking-tight">Menu da Festa</h1>
              <p className="text-[11px] text-zinc-500">Bem-vindo à mesa {TABLE_NUMBER}</p>
            </div>
            <div className="w-9" />
          </div>

          {/* Info bar */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
              <QrIcon className="h-4 w-4 text-brand" />
              <div className="flex-1">
                <div className="text-[10px] text-zinc-500">Mesa</div>
                <div className="text-sm font-semibold text-zinc-100">{TABLE_NUMBER}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
              <span className="text-brand text-base leading-none">€</span>
              <div className="flex-1">
                <div className="text-[10px] text-zinc-500">Saldo</div>
                <div className="text-sm font-semibold text-emerald-400">{BALANCE.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Products */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-32">
        <h2 className="text-lg font-bold text-zinc-100 mb-4">Escolha os seus petiscos</h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="error" message={error} />
        ) : products.length === 0 ? (
          <Alert variant="info" message="Nenhum produto disponível de momento." />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {products.map((product: any) => {
              const cartItem = cart.find((item) => item.id === product.id);
              const qty = cartItem?.quantity || 0;
              return (
                <div
                  key={product.id}
                  className={cn(
                    'rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 border',
                    qty > 0
                      ? 'bg-brand/5 border-brand/30'
                      : 'bg-surface border-border',
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-100">{product.name}</h3>
                      <span className="text-sm font-bold text-brand">
                        €{Number(product.price).toFixed(2)}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {qty > 0 && (
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="h-8 w-8 rounded-lg bg-surface border border-border text-zinc-300 hover:bg-surface-hover flex items-center justify-center transition-colors"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className={cn('text-sm font-semibold w-5 text-center', qty > 0 ? 'text-zinc-100' : 'text-transparent')}>
                      {qty}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                        qty > 0
                          ? 'bg-brand text-black hover:bg-brand-hover'
                          : 'bg-surface border border-border text-zinc-300 hover:bg-surface-hover',
                      )}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart bottom bar */}
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 z-30 transition-transform duration-300',
          cartCount > 0 ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="max-w-lg mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={handlePlaceOrder}
            className="w-full mb-1 bg-brand hover:bg-brand-hover text-black font-bold py-4 rounded-2xl shadow-glow flex items-center justify-between px-6 transition-colors"
          >
            <span>{cartCount} item{cartCount === 1 ? '' : 's'}</span>
            <span className="text-lg">€{getCartTotal().toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-surface-solid border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-400 mb-4">
                  <CheckIcon className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-50">Pedido Confirmado</h2>
                <p className="text-zinc-500 text-sm mt-1">A sua encomenda foi enviada para a cozinha!</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface"
              >
                <QrIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 mb-5">
              {cart.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm text-zinc-300">
                  <span>
                    <span className="text-zinc-500">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-zinc-500 font-medium">Total</span>
              <span className="text-2xl font-bold text-brand">€{getCartTotal().toFixed(2)}</span>
            </div>

            <Button
              size="lg"
              className="w-full mt-6"
              onClick={() => {
                setShowPaymentModal(false);
                setCart([]);
                router.push('/');
              }}
            >
              OK, obrigado!
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}