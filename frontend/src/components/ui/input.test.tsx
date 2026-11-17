// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Input } from './input';
import { Textarea } from './textarea';

afterEach(cleanup);

describe('Input — acessibilidade', () => {
  it('associa o label ao campo', () => {
    render(<Input label="Endereço de email" />);
    expect(screen.getByLabelText('Endereço de email')).toBeTruthy();
  });

  it('gera IDs diferentes para campos com o mesmo label', () => {
    render(
      <>
        <Input label="Código" />
        <Input label="Código" />
      </>,
    );

    const fields = screen.getAllByLabelText('Código');
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });

  it('liga a mensagem de erro ao campo e marca aria-invalid', () => {
    render(<Input label="Email" error="Introduz um email válido." />);
    const field = screen.getByLabelText('Email');
    const error = screen.getByRole('alert');

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(error.id);
    expect(error.textContent).toBe('Introduz um email válido.');
  });

  it('liga a ajuda ao campo quando não existe erro', () => {
    render(<Input label="Código" hint="Usa o código recebido no talão." />);
    const field = screen.getByLabelText('Código');
    const hint = screen.getByText('Usa o código recebido no talão.');

    expect(field.getAttribute('aria-describedby')).toBe(hint.id);
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('preserva aria-describedby fornecido pelo consumidor', () => {
    render(
      <>
        <span id="ajuda-extra">Informação adicional</span>
        <Input label="Email" hint="Formato nome@dominio.pt" aria-describedby="ajuda-extra" />
      </>,
    );

    const field = screen.getByLabelText('Email');
    expect(field.getAttribute('aria-describedby')).toContain('ajuda-extra');
    expect(field.getAttribute('aria-describedby')).toContain('-hint');
  });
});

describe('Textarea — acessibilidade', () => {
  it('associa label, erro e aria-invalid', () => {
    render(<Textarea label="Observações" error="Texto demasiado longo." />);
    const field = screen.getByLabelText('Observações');
    const error = screen.getByRole('alert');

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('gera IDs únicos para labels repetidos', () => {
    render(
      <>
        <Textarea label="Notas" />
        <Textarea label="Notas" />
      </>,
    );

    const fields = screen.getAllByLabelText('Notas');
    expect(fields[0].id).not.toBe(fields[1].id);
  });
});
