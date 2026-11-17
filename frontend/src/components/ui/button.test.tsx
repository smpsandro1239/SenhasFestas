// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './button';

afterEach(cleanup);

describe('Button — operação e acessibilidade', () => {
  it('usa texto branco na variante principal para melhorar o contraste', () => {
    render(<Button>Confirmar pedido</Button>);
    const button = screen.getByRole('button', { name: 'Confirmar pedido' });

    expect(button.className).toContain('text-white');
    expect(button.className).not.toContain('text-zinc-950');
  });

  it('disponibiliza um tamanho touch com altura mínima de 48px', () => {
    render(<Button size="touch">Adicionar</Button>);
    const button = screen.getByRole('button', { name: 'Adicionar' });

    expect(button.className).toContain('min-h-12');
  });

  it('expõe o estado de carregamento e impede submissões repetidas', () => {
    render(<Button loading>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('mantém os botões desativados indisponíveis', () => {
    render(<Button disabled>Indisponível</Button>);
    expect(screen.getByRole('button', { name: 'Indisponível' }).hasAttribute('disabled')).toBe(true);
  });
});
// @vitest-environment jsdom
