import { describe, it, expect } from 'vitest';
import { calcularEstadoPedido } from './qr-order-estado';

describe('calcularEstadoPedido', () => {
  it('sem evento selecionado + 2 possíveis → sem-evento com eventosDisponiveis: 2', () => {
    const r = calcularEstadoPedido({
      eventId: '',
      saldo: 0,
      produtosCount: 0,
      erroCarregamento: false,
      eventosPossiveis: 2,
    });
    expect(r).toEqual({ tipo: 'sem-evento', eventosDisponiveis: 2 });
  });

  it('sem evento selecionado + 0 possíveis → sem-evento com eventosDisponiveis: 0', () => {
    const r = calcularEstadoPedido({
      eventId: '',
      saldo: 0,
      produtosCount: 0,
      erroCarregamento: false,
      eventosPossiveis: 0,
    });
    expect(r).toEqual({ tipo: 'sem-evento', eventosDisponiveis: 0 });
  });

  it('evento encerrado → evento-encerrado', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'closed',
      saldo: 100,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'evento-encerrado' });
  });

  it('evento activo, saldo = 0, 5 produtos → sem-saldo', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 0,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'sem-saldo', saldo: 0 });
  });

  it('evento activo, saldo = 100, 0 produtos → sem-produtos com saldo: 100', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 100,
      produtosCount: 0,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'sem-produtos', saldo: 100 });
  });

  it('evento activo, saldo = 0, 0 produtos → sem-produtos com saldo: 0', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 0,
      produtosCount: 0,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'sem-produtos', saldo: 0 });
  });

  it('evento activo, saldo = 100, 5 produtos → pronto', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 100,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'pronto', produtos: 5 });
  });

  it('erro de carregamento → erro-carregamento (prioritário)', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 100,
      produtosCount: 0,
      erroCarregamento: true,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'erro-carregamento' });
  });

  it('janela de datas fechada → evento-encerrado mesmo com status active', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      eventoWindowOpen: false,
      saldo: 100,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 1,
    });
    expect(r).toEqual({ tipo: 'evento-encerrado' });
  });

  it('sem-saldo com saldo noutro evento → devolve o campo saldoOutroEvento', () => {
    const outro = { saldo: 50, nomeEvento: 'Magusto' };
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 0,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 2,
      saldoOutroEvento: outro,
    });
    expect(r).toEqual({ tipo: 'sem-saldo', saldo: 0, saldoOutroEvento: outro });
  });

  it('sem-saldo sem saldo noutro evento → não inclui o campo', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 0,
      produtosCount: 5,
      erroCarregamento: false,
      eventosPossiveis: 2,
      saldoOutroEvento: null,
    });
    expect(r).toEqual({ tipo: 'sem-saldo', saldo: 0 });
  });

  it('com produtos, saldo noutro evento e erro de carregamento → erro (não sem-saldo)', () => {
    const r = calcularEstadoPedido({
      eventId: 'e1',
      eventoStatus: 'active',
      saldo: 0,
      produtosCount: 5,
      erroCarregamento: true,
      eventosPossiveis: 2,
      saldoOutroEvento: { saldo: 50, nomeEvento: 'Magusto' },
    });
    expect(r).toEqual({ tipo: 'erro-carregamento' });
  });
});