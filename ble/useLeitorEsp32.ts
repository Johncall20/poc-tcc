/*
  A janela da tela para a fonte de dados: estado da ligacao, ultima amostra
  e as contagens que mostram se o link esta saudavel.

  Duas fontes, com os mesmos ouvintes: o LeitorEsp32 (Bluetooth de verdade)
  e a FonteSimulada (o LeitorSimulado do backend, sem radio). Cada uma so e
  criada quando usada.
*/
import { useEffect, useRef, useState } from 'react';

import { FonteSimulada } from './FonteSimulada';
import { LeitorEsp32, type EstadoLeitor, type Ouvintes } from './LeitorEsp32';
import type { Amostra } from './protocolo';

/** Quantas chegadas guardar para calcular a taxa (Hz). */
const JANELA_TAXA = 10;

/** O simulador a 5 Hz, com uma queda de 5 s a cada 30 s lendo. */
const OPCOES_SIMULADOR = { hz: 5, queda: { ativoS: 30, quedaS: 5 } };

export type Modo = 'bluetooth' | 'simulador';

type Fonte = { ligar(): Promise<void>; desligar(): Promise<void>; destruir(): void };

export type Leitura = {
  amostra: Amostra | null;
  /** Date.now() das ultimas chegadas, pelo relogio do celular. */
  chegadas: number[];
  linhas: number;
  descartadas: number;
};

const LEITURA_VAZIA: Leitura = { amostra: null, chegadas: [], linhas: 0, descartadas: 0 };

export function useLeitorEsp32(modo: Modo) {
  const [ligacao, setLigacao] = useState<{ estado: EstadoLeitor; detalhe: string; ativo: boolean }>({
    estado: 'DESLIGADO',
    detalhe: '',
    ativo: false,
  });
  const [leitura, setLeitura] = useState<Leitura>(LEITURA_VAZIA);

  const ouvintes = useRef<Ouvintes>({
    aoMudarEstado: (estado, detalhe, ativo) => setLigacao({ estado, detalhe, ativo }),
    aoLer: (amostra) =>
      setLeitura((antes) => ({
        amostra,
        chegadas: [...antes.chegadas, Date.now()].slice(-JANELA_TAXA),
        linhas: antes.linhas + 1,
        descartadas: antes.descartadas,
      })),
    aoDescartar: () => setLeitura((antes) => ({ ...antes, descartadas: antes.descartadas + 1 })),
  });
  const fontes = useRef<Partial<Record<Modo, Fonte>>>({});

  const fonte = (m: Modo): Fonte =>
    (fontes.current[m] ??=
      m === 'simulador'
        ? new FonteSimulada(ouvintes.current, OPCOES_SIMULADOR)
        : new LeitorEsp32(ouvintes.current));

  // Trocou de modo: a fonte do modo anterior para.
  useEffect(() => () => void fontes.current[modo]?.desligar(), [modo]);
  useEffect(() => () => Object.values(fontes.current).forEach((f) => f?.destruir()), []);

  return {
    ...ligacao,
    ...leitura,
    ligar: () => {
      setLeitura(LEITURA_VAZIA);
      void fonte(modo).ligar();
    },
    desligar: () => void fonte(modo).desligar(),
  };
}

/** Amostras por segundo nas ultimas chegadas; null sem chegadas suficientes. */
export function taxaHz(chegadas: number[]): number | null {
  if (chegadas.length < 2) return null;
  const intervalo = chegadas[chegadas.length - 1] - chegadas[0];
  return intervalo > 0 ? ((chegadas.length - 1) * 1000) / intervalo : null;
}
