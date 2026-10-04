import { describe, it, expect } from 'vitest';
import { kitchenDisplayName } from './kitchen-name';

describe('kitchenDisplayName', () => {
  it('prefere o kitchenName do produto', () => {
    expect(
      kitchenDisplayName({
        name: 'Bifana',
        product: { name: 'Bifana PF', kitchenName: 'Bifana da casa' },
      }),
    ).toBe('Bifana da casa');
  });

  it('sem kitchenName usa o retrato do item', () => {
    // o retrato é o nome no momento da encomenda. Se o produto foi renomeado
    // depois, o KDS continua a mostrar o que foi pedido.
    expect(kitchenDisplayName({ name: 'Bifana', product: { name: 'Bifana PF' } })).toBe('Bifana');
  });

  it('cai no nome do produto quando o item não tem nome', () => {
    expect(kitchenDisplayName({ name: '', product: { name: 'Bifana PF' } })).toBe('Bifana PF');
  });

  it('kitchenName vazio não apaga o fallback', () => {
    // string vazia é o que um input limpo devolve. Com || e nao ??, cai
    // no retrato; com ?? devolveria '' e o KDS ficava sem nome.
    expect(kitchenDisplayName({ name: 'Bifana', product: { name: 'X', kitchenName: '' } })).toBe(
      'Bifana',
    );
  });

  it('produto apagado ou sem relação ainda mostra o retrato', () => {
    expect(kitchenDisplayName({ name: 'Bifana', product: null })).toBe('Bifana');
    expect(kitchenDisplayName({ name: 'Bifana' })).toBe('Bifana');
  });

  it('sem nada devolve string vazia e nao undefined', () => {
    // o valor vai para um <span>. undefined desenhava "undefined".
    expect(kitchenDisplayName({})).toBe('');
    expect(kitchenDisplayName({ name: null, product: null })).toBe('');
  });
});
