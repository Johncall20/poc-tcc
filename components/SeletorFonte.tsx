import { StyleSheet, Switch, Text, View } from 'react-native';

import type { Modo } from '../ble/useLeitorEsp32';
import { cores } from './cores';

type Props = {
  modo: Modo;
  /** Com a fonte ligada nao troca: desconecte antes. */
  bloqueado: boolean;
  aoTrocar: (modo: Modo) => void;
};

/**
 * Escolhe entre o Bluetooth de verdade e o simulador. No simulador, o aviso
 * fica na tela o tempo todo: ninguem pode confundir os numeros com os do carro.
 */
export function SeletorFonte({ modo, bloqueado, aoTrocar }: Props) {
  const simulador = modo === 'simulador';
  return (
    <View style={estilos.caixa}>
      <View style={estilos.linha}>
        <View style={estilos.texto}>
          <Text style={estilos.rotulo}>Simulador</Text>
          <Text style={estilos.ajuda}>{bloqueado ? 'desconecte para trocar a fonte' : 'usar dados simulados em vez do ESP32'}</Text>
        </View>
        <Switch
          value={simulador}
          onValueChange={(ligado) => aoTrocar(ligado ? 'simulador' : 'bluetooth')}
          disabled={bloqueado}
          trackColor={{ true: cores.procurando, false: cores.borda }}
          accessibilityLabel="Usar o simulador"
        />
      </View>
      {simulador ? (
        <View style={estilos.aviso} accessible accessibilityRole="alert">
          <Text style={estilos.avisoTitulo}>DADOS SIMULADOS</Text>
          <Text style={estilos.avisoTexto}>
            Gerados no celular pelo LeitorSimulado do backend do TCC. Nenhum Bluetooth é usado: só o
            decodificador e a tela são os de verdade.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { gap: 10 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  texto: { flex: 1, gap: 2 },
  rotulo: { color: cores.texto, fontSize: 15, fontWeight: '600' },
  ajuda: { color: cores.textoFraco, fontSize: 13 },
  aviso: { backgroundColor: '#3A2C10', borderColor: cores.procurando, borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  avisoTitulo: { color: cores.procurando, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  avisoTexto: { color: cores.texto, fontSize: 13, lineHeight: 18 },
});
