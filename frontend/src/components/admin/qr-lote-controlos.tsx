'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface QrLoteControlosProps {
  tamanho: number;
  onTamanho: (valor: number) => void;
  colunas: number;
  onColunas: (valor: number) => void;
  linhas: number;
  onLinhas: (valor: number) => void;
  className?: string;
}

export function QrLoteControlos({
  tamanho,
  onTamanho,
  colunas,
  onColunas,
  linhas,
  onLinhas,
  className,
}: QrLoteControlosProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      <label className="block">
        <span className="block text-sm font-medium text-zinc-400 mb-1.5">Tamanho</span>
        <select
          value={tamanho}
          onChange={(e) => onTamanho(Number(e.target.value))}
          className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
        >
          <option value={120}>Pequeno</option>
          <option value={160}>Médio</option>
          <option value={200}>Grande</option>
        </select>
      </label>
      <Input
        label="Colunas"
        type="number"
        min="1"
        max="6"
        value={colunas}
        onChange={(e) => onColunas(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
      />
      <Input
        label="Linhas"
        type="number"
        min="1"
        max="8"
        value={linhas}
        onChange={(e) => onLinhas(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
      />
    </div>
  );
}
