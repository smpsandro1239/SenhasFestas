// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Dialog } from './dialog';

// Testes do WIRING React, nao do comportamento nativo. O focus trap, o Escape e
// o ::backdrop vem do elemento <dialog> e sao garantia do browser — o jsdom nao
// os implementa e nao os poderiamos partir com um refactor.
//
// O que se testa aqui e onde os bugs ficam: se showModal e chamado na hora
// certa, se close e chamado quando o estado fecha, e sobretudo se onClose nao
// dispara duas vezes quando o React e o browser fazem a mesma coisa.
//
// showModal/close sao stubados porque o jsdom nao os implementa. O stub
// tambem define `open`, senao o guard `!el.open` no componente nunca ve um
// elemento fechado.

let showModal: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;

beforeEach(() => {
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    // o elemento emite 'close' tal como o browser
    this.dispatchEvent(new Event('close'));
  });
  HTMLDialogElement.prototype.showModal = showModal as any;
  HTMLDialogElement.prototype.close = close as any;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Dialog — abertura', () => {
  it('chama showModal quando open passa a true', () => {
    render(<Dialog open onClose={vi.fn()} title="Editar produto" />);
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('nao volta a chamar showModal num re-render com open ainda true', () => {
    // showModal() num elemento ja aberto atira InvalidStateError em Chromium.
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open onClose={onClose} title="Editar" />);
    rerender(<Dialog open onClose={onClose} title="Editar" />);
    rerender(<Dialog open onClose={onClose} title="Editar" />);
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('so chama showModal uma vez em StrictMode, que invoca o efeito duas vezes', () => {
    // E este o que realmente exercita o guard `!el.open`. O efeito tem deps
    // [open], portanto um re-render com open igual nao o volta a correr — o
    // unico caminho em que showModal seria chamado duas vezes e o
    // mount-desmount-mount do StrictMode. Sem o guard, a segunda chamada
    // atira InvalidStateError em Chromium.
    //
    // NOTA: o teste anterior (re-render com open igual) passa mesmo sem o
    // guard. Foi verificado por mutacao.
    render(
      <StrictMode>
        <Dialog open onClose={vi.fn()} title="Editar" />
      </StrictMode>,
    );
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('reabre depois de um fecho nativo que o React ainda nao reflectiu', () => {
    // Escape fecha o elemento no browser; se o parent ainda nao actualizou o
    // estado, `el.open` fica false com `open` ainda true. O proximo ciclo de
    // abertura tem de volver a chamar showModal.
    const onClose = vi.fn();
    const { getByRole, rerender } = render(<Dialog open onClose={onClose} title="Editar" />);
    const elemento = getByRole('dialog') as HTMLDialogElement;

    elemento.open = false; // fecho nativo, estado do React ainda true
    rerender(<Dialog open={false} onClose={onClose} title="Editar" />);
    rerender(<Dialog open onClose={onClose} title="Editar" />);

    expect(elemento.open).toBe(true);
  });

  it('associa o titulo via aria-labelledby com um id unico', () => {
    const { getByRole } = render(<Dialog open onClose={vi.fn()} title="Eliminar produto" />);
    const elemento = getByRole('dialog');
    const rotulado = elemento.getAttribute('aria-labelledby');
    expect(rotulado).toBeTruthy();
    // o id tem de existir no documento e apontar para o titulo
    const titulo = document.getElementById(rotulado!);
    expect(titulo?.textContent).toBe('Eliminar produto');
  });

  it('dois dialogs abertos tem ids de titulo diferentes', () => {
    const { getAllByRole } = render(
      <>
        <Dialog open onClose={vi.fn()} title="Editar" />
        <Dialog open onClose={vi.fn()} title="Eliminar" />
      </>,
    );
    const ids = getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'));
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('Dialog — fecho', () => {
  it('chama close quando open passa a false', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open onClose={onClose} title="Editar" />);
    rerender(<Dialog open={false} onClose={onClose} title="Editar" />);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('onClose dispara uma unica vez quando o utilizador fecha com Escape', () => {
    // Escape no browser emite 'close'. O nosso listener transforma isso em
    // onClose. E o guard abertoRef impede que o close que o React dispara a
    // seguir volte a chamar onClose.
    const onClose = vi.fn();
    const { getByRole } = render(<Dialog open onClose={onClose} title="Editar" />);
    const elemento = getByRole('dialog');

    fireEvent(elemento, new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('o close que o proprio React dispara nao volta a chamar onClose', () => {
    // Este e o guard. Sem ele, fechar pelo estado do parent disparava onClose
    // duas vezes: uma do nosso close() e outra do listener de 'close'.
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open onClose={onClose} title="Editar" />);
    rerender(<Dialog open={false} onClose={onClose} title="Editar" />);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('onClose dispara quando o utilizador clica no backdrop', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<Dialog open onClose={onClose} title="Eliminar" />);
    fireEvent.click(getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicar dentro do conteudo nao fecha', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <Dialog open onClose={onClose} title="Eliminar">
        <button type="button">Confirmar</button>
      </Dialog>,
    );
    fireEvent.click(getByText('Confirmar'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('remove o listener ao desmontar', () => {
    const removeSpy = vi.spyOn(HTMLDialogElement.prototype, 'removeEventListener');
    const { unmount } = render(<Dialog open onClose={vi.fn()} title="Editar" />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('close', expect.any(Function));
  });
});

describe('Dialog — acessibilidade', () => {
  it('nao associa aria-labelledby quando nao ha titulo', () => {
    const { getByRole } = render(<Dialog open onClose={vi.fn()}>conteudo</Dialog>);
    expect(getByRole('dialog').getAttribute('aria-labelledby')).toBeNull();
  });

  it('associa aria-describedby quando ha descricao', () => {
    const { getByRole } = render(
      <Dialog open onClose={vi.fn()} title="Eliminar" description="Os pedidos historicos mantem o registo." />,
    );
    const elemento = getByRole('dialog');
    const id = elemento.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe(
      'Os pedidos historicos mantem o registo.',
    );
  });
});
