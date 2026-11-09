/*
  O simulador: estados como os do LeitorSimulado do backend e amostras que
  passaram pelo mesmo MontadorDeLinha/decodificar da fonte real.
*/
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { FonteSimulada } from './FonteSimulada';
import type { EstadoLeitor } from './LeitorEsp32';
import { respondeu, type Amostra } from './protocolo';

function montar(opcoes: ConstructorParameters<typeof FonteSimulada>[1] = {}) {
  const estados: [EstadoLeitor, string, boolean][] = [];
  const amostras: Amostra[] = [];
  const descartes: string[] = [];
  const fonte = new FonteSimulada(
    { aoMudarEstado: (e, d, a) => estados.push([e, d, a]), aoLer: (a) => amostras.push(a), aoDescartar: (l) => descartes.push(l) },
    opcoes,
  );
  return { fonte, estados, amostras, descartes, ultimo: () => estados[estados.length - 1] };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FonteSimulada', () => {
  test('procura, conecta em 0,5 s e entrega 5 amostras por segundo', async () => {
    const t = montar({ hz: 5 });
    await t.fonte.ligar();
    expect(t.ultimo()).toEqual(['PROCURANDO', 'iniciando simulador', true]);
    await jest.advanceTimersByTimeAsync(500);
    expect(t.ultimo()).toEqual(['CONECTADO', 'simulador do TCC, sem Bluetooth', true]);
    await jest.advanceTimersByTimeAsync(1000);
    expect(t.amostras.length).toBeGreaterThanOrEqual(5);
    expect(t.descartes).toEqual([]);
  });

  test('os numeros ficam nas faixas do LeitorSimulado', async () => {
    const t = montar({ hz: 5 });
    await t.fonte.ligar();
    await jest.advanceTimersByTimeAsync(60_000);
    for (const a of t.amostras) {
      expect(a.rpm).toBeGreaterThanOrEqual(650);
      expect(a.rpm).toBeLessThanOrEqual(7000);
      expect(a.tps).toBeGreaterThanOrEqual(0);
      expect(a.tps).toBeLessThanOrEqual(100);
      expect(a.vbat).toBeGreaterThan(13.5);
      expect(a.load).not.toBeNull();
    }
    // Ao longo de um minuto, o giro sobe e desce.
    expect(Math.max(...t.amostras.map((a) => a.rpm))).toBeGreaterThan(3000);
  });

  test('as vezes um campo fica sem resposta, como a central faz', async () => {
    // Sorteio sempre 0,01: cai na chance de 6% e apaga o primeiro da lista (TPS).
    const t = montar({ hz: 5, aleatorio: () => 0.01 });
    await t.fonte.ligar();
    await jest.advanceTimersByTimeAsync(2000);
    expect(t.amostras.length).toBeGreaterThan(0);
    for (const a of t.amostras) {
      expect(respondeu(a, 'tps')).toBe(false);
      expect(respondeu(a, 'rpm')).toBe(true);
    }
  });

  test('queda simulada: para de mandar e volta sozinho', async () => {
    const t = montar({ hz: 5, queda: { ativoS: 2, quedaS: 1 } });
    await t.fonte.ligar();
    await jest.advanceTimersByTimeAsync(500 + 2100);
    expect(t.ultimo()).toEqual(['PROCURANDO', 'módulo não respondeu (queda simulada)', true]);
    const durante = t.amostras.length;
    await jest.advanceTimersByTimeAsync(800);
    expect(t.amostras.length).toBe(durante);
    await jest.advanceTimersByTimeAsync(400);
    expect(t.ultimo()[0]).toBe('CONECTADO');
    expect(t.amostras.length).toBeGreaterThan(durante);
  });

  test('desligar para tudo', async () => {
    const t = montar({ hz: 5 });
    await t.fonte.ligar();
    await jest.advanceTimersByTimeAsync(1500);
    await t.fonte.desligar();
    const total = t.amostras.length;
    await jest.advanceTimersByTimeAsync(5000);
    expect(t.amostras.length).toBe(total);
    expect(t.ultimo()).toEqual(['DESLIGADO', '', false]);
  });
});
