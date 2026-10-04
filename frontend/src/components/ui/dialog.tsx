'use client';

import { useEffect, useId, useRef, type ReactNode, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * Modal sobre o `<dialog>` nativo. O elemento dá focus trap, Escape e
 * `aria-modal` sem código nosso, o que é a razão de não ser um div com
 * position fixed.
 *
 * O `open` do React NÃO vai para o atributo `open` do elemento: esse atributo
 * abre o dialog nao-modal, sem top layer e sem backdrop. A modality vem de
 * `showModal()`/`close()`, chamados por efeito.
 *
 * O dialog em si não tem padding — o clique no backdrop tem `target` igual ao
 * elemento, e sem padding isso só acontece mesmo no backdrop. O padding vive
 * no wrapper interior.
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const abertoRef = useRef(open);
  abertoRef.current = open;
  // onClose num ref, e nao nas deps: o parent passa uma funcao inline
  // (`onClose={() => setX(false)}`), o que re-anexaria o listener em cada
  // render. Nao quebra nada aqui, mas e fragile e resolve-se com um ref.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // id gerado, nao fixo: dois dialogs abertos ao mesmo tempo dariam ids
  // duplicados e o aria-labelledby passava a apontar para o titulo errado.
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // O evento `close` dispara tanto no Escape (utilizador) como no nosso
    // próprio `el.close()`. Sem este guard, fechar pelo estado do React
    // voltava a chamar onClose numa dialog já fechada.
    const aoFechar = () => {
      if (abertoRef.current) onCloseRef.current();
    };
    el.addEventListener('close', aoFechar);
    return () => el.removeEventListener('close', aoFechar);
  }, []);

  const aoClicar = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  const semTitulo = !title;

  return (
    <dialog
      ref={ref}
      onClick={aoClicar}
      aria-labelledby={semTitulo ? undefined : idTitulo}
      aria-describedby={!description || semTitulo ? undefined : idDescricao}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl',
        'bg-surface-solid border border-border text-zinc-100 shadow-elevated',
        'backdrop:bg-black/60',
        className,
      )}
    >
      <div className="p-6">
        {title && (
          <h2 id={idTitulo} className="text-lg font-bold text-zinc-50">
            {title}
          </h2>
        )}
        {description && (
          <p id={idDescricao} className="mt-1 text-sm text-zinc-400">
            {description}
          </p>
        )}
        {children && <div className={cn(title || description ? 'mt-4' : undefined)}>{children}</div>}
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
