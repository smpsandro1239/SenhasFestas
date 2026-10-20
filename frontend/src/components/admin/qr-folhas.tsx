'use client';

import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { montarUrlMesa } from '@/lib/mesa-qr';
import type { FolhaQr } from '@/lib/qr-lote';

interface QrFolhasProps {
  folhas: FolhaQr[];
  colunas: number;
  tamanho: number;
  shortCode: string;
  lugares: Record<string, number>;
  origem: string;
}

export function QrFolhas({
  folhas,
  colunas,
  tamanho,
  shortCode,
  lugares,
  origem,
}: QrFolhasProps) {
  return (
    <>
      {folhas.map((folha, fi) => (
        <div key={fi} className="qr-sheet" style={{ '--qr-cols': colunas } as CSSProperties}>
          {folha.titulo && <span className="qr-sheet-titulo">{folha.titulo}</span>}
          {folha.mesas.map((mesa) => (
            <div key={`${folha.titulo ?? ''}\u0000${mesa}`} className="qr-card">
              <QRCodeSVG
                value={montarUrlMesa(origem, shortCode, mesa)}
                size={tamanho}
                level="M"
                className="max-w-full h-auto"
              />
              <span className="qr-card-label">
                {mesa}
                {(lugares[mesa] ?? 0) > 0 ? ` · ${lugares[mesa]} lugares` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
