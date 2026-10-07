'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { getEventByCode } from '@/lib/api';
import { normalizarShortCode } from '@/lib/entrar';

export default function MesaPage() {
  const params = useParams<{ shortCode: string; numero: string }>();
  const router = useRouter();
  const codigoParam = typeof params?.shortCode === 'string' ? params.shortCode : '';
  const numeroParam = typeof params?.numero === 'string' ? params.numero : '';
  const codigo = normalizarShortCode(codigoParam);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    if (!codigo || !numeroParam) {
      setNaoEncontrado(true);
      return;
    }
    let ativo = true;
    getEventByCode(codigo)
      .then((ev) => {
        if (!ativo) return;
        if (!ev) {
          setNaoEncontrado(true);
          return;
        }
        router.replace(
          `/entrar/${encodeURIComponent(codigoParam)}?table=${encodeURIComponent(numeroParam)}`,
        );
      })
      .catch(() => {
        if (ativo) setNaoEncontrado(true);
      });
    return () => {
      ativo = false;
    };
  }, [codigo, codigoParam, numeroParam, router]);

  if (naoEncontrado) {
    return (
      <AuthLayout subtitle="QR da mesa">
        <div className="space-y-6 text-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50">Evento não encontrado</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Este QR não corresponde a nenhum evento. Pede um novo QR à organização.
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => router.push('/')}
          >
            Início
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="A abrir a tua mesa...">
      <div className="space-y-3" aria-busy="true" aria-label="A verificar o QR da mesa">
        <div className="shimmer h-16 rounded-2xl" />
        <div className="shimmer h-16 rounded-2xl" />
        <div className="shimmer h-16 rounded-2xl" />
      </div>
    </AuthLayout>
  );
}