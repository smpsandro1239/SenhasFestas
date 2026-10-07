'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCurrentEvent } from '@/lib/use-current-event';
import { getBalance } from '@/lib/api';
import { calcularAviso, deveAvisarHoje, marcarAvisoHoje, type AvisoSaldo } from '@/lib/saldo-aviso';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Aviso de prazo de saldo para o cliente: banner persistente enquanto o
 * prazo estiver na janela e popup no máximo uma vez por dia.
 */
export function SaldoAviso() {
  const { user } = useAuth();
  const { event } = useCurrentEvent();
  const eventId = event?.id;
  const [aviso, setAviso] = useState<AvisoSaldo | null>(null);
  const [popup, setPopup] = useState(false);

  useEffect(() => {
    if (!user?.id || !eventId) {
      setAviso(null);
      return;
    }
    let cancelado = false;
    getBalance(user.id, eventId)
      .then((b) => {
        if (cancelado) return;
        const estado = calcularAviso(b ?? {});
        setAviso(estado);
        if (estado && deveAvisarHoje(eventId)) {
          marcarAvisoHoje(eventId);
          setPopup(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [user?.id, eventId]);

  if (!aviso) return null;

  const expirado = aviso.tipo === 'expirado';
  const titulo = expirado ? 'Saldo expirado' : 'O teu saldo expira em breve';
  const mensagem = expirado
    ? `O prazo do saldo terminou a ${aviso.prazo}. Contacta a equipa do evento para regularizar.`
    : aviso.dias === 1
      ? `O teu saldo de €${aviso.saldo.toFixed(2)} expira amanhã (${aviso.prazo}). Usa-o antes desse prazo.`
      : `O teu saldo de €${aviso.saldo.toFixed(2)} expira em ${aviso.dias} dias (${aviso.prazo}). Usa-o antes desse prazo.`;

  return (
    <>
      <div className="mb-6">
        <Alert variant={expirado ? 'error' : 'warning'} title={titulo} message={mensagem} />
      </div>

      <Dialog
        open={popup}
        onClose={() => setPopup(false)}
        title={titulo}
        footer={
          <Button variant="secondary" onClick={() => setPopup(false)}>
            Compreendi
          </Button>
        }
      >
        <p className="text-sm text-zinc-300">{mensagem}</p>
        {!expirado && (
          <p className="mt-3 text-sm text-zinc-400">
            Depois desse prazo o saldo deixa de ser aceite nas compras do evento.
          </p>
        )}
      </Dialog>
    </>
  );
}
