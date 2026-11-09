/*
  Fonte de mentira, para mostrar o app sem o ESP32: o LeitorSimulado do
  backend (telemetria-desktop/backend/telemetria/servicos/leitor.py)
  portado para o celular, com os mesmos numeros e a mesma queda opcional.

  NAO usa Bluetooth. Monta a linha JSON no formato do firmware, corta em
  pedacos de 20 bytes como o notify do ESP32 e passa pelo mesmo
  MontadorDeLinha e decodificar da fonte real: so o radio fica de fora.
  A tela avisa que os dados sao simulados.
*/
import type { EstadoLeitor, Ouvintes } from './LeitorEsp32';
import { BITS_EXTRAS, MontadorDeLinha, decodificar } from './protocolo';

const VALID_NUCLEO = 0x7f;
const TODOS_EXTRAS = Object.values(BITS_EXTRAS).reduce((a, b) => a | b, 0);
const TAMANHO_PEDACO = 20; // o notify do ESP32 com MTU padrao
const DETALHE = 'simulador do TCC, sem Bluetooth';

export type OpcoesSimulador = {
  /** Amostras por segundo. O backend usa 1; o replay do painel, 5. */
  hz?: number;
  /** Como o TELEMETRIA_SIM_QUEDA do backend: `ativoS` lendo, `quedaS` sem nada. */
  queda?: { ativoS: number; quedaS: number } | null;
  /** Para teste: troca o Math.random. */
  aleatorio?: () => number;
};

export class FonteSimulada {
  private estado: EstadoLeitor = 'DESLIGADO';
  private detalhe = '';
  private ativo = false;
  private ativoAvisado = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private montador = new MontadorDeLinha();
  private t0 = 0;
  private ultimoTique = 0;
  private rpm = 780;
  private ect = 22;
  private readonly periodoMs: number;
  private readonly queda: OpcoesSimulador['queda'];
  private readonly aleatorio: () => number;

  constructor(
    private readonly ouvintes: Ouvintes,
    opcoes: OpcoesSimulador = {},
  ) {
    this.periodoMs = 1000 / (opcoes.hz ?? 5);
    this.queda = opcoes.queda ?? null;
    this.aleatorio = opcoes.aleatorio ?? Math.random;
  }

  async ligar(): Promise<void> {
    if (this.ativo) return;
    this.ativo = true;
    this.rpm = 780;
    this.ect = 22;
    this.definir('PROCURANDO', 'iniciando simulador');
    this.esperar(500, () => {
      this.t0 = Date.now();
      this.ultimoTique = this.t0;
      this.montador = new MontadorDeLinha();
      this.definir('CONECTADO', DETALHE);
      this.tique();
    });
  }

  async desligar(): Promise<void> {
    this.ativo = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.definir('DESLIGADO', '');
  }

  destruir(): void {
    void this.desligar();
  }

  private tique(): void {
    if (!this.ativo) return;
    const agora = Date.now();
    const t = (agora - this.t0) / 1000;
    const dt = Math.max(0.001, (agora - this.ultimoTique) / 1000);
    this.ultimoTique = agora;

    const queda = this.queda;
    const caiu = queda != null && t % (queda.ativoS + queda.quedaS) >= queda.ativoS;
    if (caiu) {
      this.definir('PROCURANDO', 'módulo não respondeu (queda simulada)');
    } else {
      if (this.estado !== 'CONECTADO') this.montador = new MontadorDeLinha();
      this.definir('CONECTADO', DETALHE);
      this.enviar(this.linha(t, dt));
    }
    this.esperar(this.periodoMs, () => this.tique());
  }

  /** O caminho da fonte real, sem o radio: bytes em pedacos de 20. */
  private enviar(linha: string): void {
    const bytes = Array.from(`${linha}\n`, (c) => c.charCodeAt(0));
    for (let i = 0; i < bytes.length; i += TAMANHO_PEDACO) {
      for (const pronta of this.montador.alimentar(bytes.slice(i, i + TAMANHO_PEDACO))) {
        const amostra = decodificar(pronta);
        if (amostra) this.ouvintes.aoLer(amostra);
        else this.ouvintes.aoDescartar(pronta);
      }
    }
  }

  private u(min: number, max: number): number {
    return min + (max - min) * this.aleatorio();
  }

  /**
   * Uma leitura no formato do firmware, com os numeros do LeitorSimulado.
   * O backend roda a 1 Hz; o `dt` deixa o giro e a temperatura andarem no
   * mesmo ritmo a qualquer taxa.
   */
  private linha(t: number, dt: number): string {
    const suave = (k: number) => 1 - Math.pow(1 - k, dt);

    const alvo = 800 + Math.pow(Math.max(0, Math.sin(t / 9)), 3) * 5800;
    this.rpm += (alvo - this.rpm) * suave(0.45) + this.u(-40, 40);
    this.rpm = Math.max(650, Math.min(7000, this.rpm));
    this.ect += (94 - this.ect) * suave(0.012) + this.u(-0.3, 0.3);

    const rpm = this.rpm;
    const tps = Math.max(0, Math.min(100, (rpm - 750) / 62 + this.u(-1, 1)));
    const vss = Math.trunc(Math.max(0, (rpm - 900) / 38));
    const vanos = rpm < 1500 ? 8 : Math.min(96, 8 + (rpm - 1500) / 55);
    const vbat = 13.9 - (rpm > 5000 ? 0.25 : 0) + this.u(-0.06, 0.06);
    const iat = 28 + Math.sin(t / 30) * 3;

    // Extras da MS41: so precisam parecer de carro (comentario do backend).
    const carga = 0.25 + (0.75 * tps) / 100;
    const maf = 12 + (rpm / 7000) * carga * 600 + this.u(-2, 2);
    const knock = tps > 80 && this.aleatorio() < 0.1 ? -(this.aleatorio() < 0.5 ? 1.5 : 3.0) : 0;

    let valid = VALID_NUCLEO | TODOS_EXTRAS;
    if (this.aleatorio() < 0.06) {
      // a central deixa de responder um campo
      const bits = [0x04, 0x08, 0x40, BITS_EXTRAS.maf, BITS_EXTRAS.lam2];
      valid &= ~bits[Math.floor(this.aleatorio() * bits.length)];
    }

    const r = (v: number, casas: number) => Number(v.toFixed(casas));
    return JSON.stringify({
      t: Math.trunc(t * 1000),
      rpm: Math.trunc(rpm),
      ect: Math.trunc(this.ect),
      iat: Math.trunc(iat),
      vbat: r(vbat, 2),
      tps: r(tps, 1),
      vanos: r(vanos, 1),
      vss,
      load: r(130 + carga * 480 + this.u(-5, 5), 1),
      maf: r(maf, 1),
      mafv: r(Math.min(5, 0.9 + maf / 180), 2),
      knock,
      ign: r(12 + (Math.min(rpm, 4500) / 4500) * 22 - tps * 0.08 + this.u(-0.5, 0.5), 1),
      inj: r(2.4 + carga * 9 + this.u(-0.1, 0.1), 2),
      iacv: r(Math.max(0, 28 - (rpm - 750) / 100) + this.u(-0.5, 0.5), 1),
      lint1: r(this.u(-4, 4), 1),
      lint2: r(this.u(-4, 4), 1),
      lam1: r(0.5 + 0.4 * Math.sin(t * 2.1), 2),
      lam2: r(0.5 + 0.4 * Math.sin(t * 1.9 + 1.0), 2),
      valid,
    });
  }

  private esperar(ms: number, depois: () => void): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      depois();
    }, ms);
  }

  private definir(estado: EstadoLeitor, detalhe: string): void {
    if (estado === this.estado && detalhe === this.detalhe && this.ativo === this.ativoAvisado) return;
    this.estado = estado;
    this.detalhe = detalhe;
    this.ativoAvisado = this.ativo;
    this.ouvintes.aoMudarEstado(estado, detalhe, this.ativo);
  }
}
