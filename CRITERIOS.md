# Critérios de aceitação

Pergunta: o celular consegue ler o ESP32-C3 do carro pelo Bluetooth, em tempo real, sem o computador com o backend?

Todos são conferidos **no aparelho físico** (emulador não tem Bluetooth), com a development build instalada e o ESP32 ligado no carro ou na bancada com a MS41. O computador com o backend fica **desligado** durante o teste.

- [ ] **Conecta sozinho.** Ao tocar em *Conectar* com o ESP32 ligado, em até 15 s a barra mostra *Conectado* com o id do módulo, e o RPM começa a mudar na tela sem nenhum outro toque.
- [ ] **O número é o do carro.** Em marcha lenta e depois a ~3000 rpm, o RPM do app acompanha o conta-giros do painel do carro (diferença de até ±100 rpm). Com o motor quente e parado, desconectando o celular e subindo o backend, a temperatura do motor no *Ao vivo* do telemetria-desktop fica a até ±2 °C da que o app mostrava.
- [ ] **O link é saudável.** Com o carro parado por 2 minutos, a taxa (Hz) fica estável e o contador de *descartadas* não passa de 1% das *leituras*.
- [ ] **Parâmetro sem resposta não engana.** Quando a central deixa de responder um campo (bit apagado em `valid`), o cartão dele mostra *sem resposta* em vez de repetir o número anterior.
- [ ] **Erro: módulo ausente.** Com o ESP32 desligado, a barra fica em *Procurando — módulo não apareceu, tentando de novo*, o app não trava nem fecha, e ao ligar o ESP32 ele conecta sozinho.
- [ ] **Erro: queda no meio.** Desligando o ESP32 com o app conectado, em até 3 s a linha *última leitura há X s* fica vermelha e os números apagam; ao religar, a barra volta a *Conectado* sem tocar em nada.
- [ ] **Erro: permissão negada (Android).** Negando *Dispositivos próximos* no primeiro *Conectar*, a barra mostra *Erro — permissão de "Dispositivos próximos" negada* e o app continua aberto.
- [ ] **Fechar e abrir.** Fechando o app e abrindo de novo, ele começa em *Desligado* e só procura o módulo depois de tocar em *Conectar*.

**Verificado em:** ( ) aparelho físico — modelo: ______ / Android ou iOS: ______ ( ) emulador
**Resultado:** ( ) passou ( ) reprovou

## Modo Simulador (sem o ESP32)

Para a apresentação sem o hardware. Liga o seletor **Simulador** e toca em *Conectar*. Estes critérios conferem a tela, os estados e o decodificador; **não** provam o Bluetooth, que continua pendente acima.

- [ ] A faixa *DADOS SIMULADOS* aparece assim que o Simulador é ligado, e some ao desligá-lo.
- [ ] Em até 1 s a barra mostra *Conectado — simulador do TCC, sem Bluetooth* e o RPM sobe e desce sozinho.
- [ ] A taxa fica perto de 5 Hz e *descartadas* fica em 0 (as linhas passam pelo mesmo montador e decodificador da fonte real).
- [ ] De vez em quando um cartão mostra *sem resposta* por uma leitura (o simulador apaga um bit de `valid` em ~6% delas, como o do backend).
- [ ] A cada ~30 s há uma queda simulada de 5 s: a barra vai a *Procurando*, a *última leitura* fica vermelha depois de 3 s e o app volta a *Conectado* sozinho.
- [ ] Com a fonte ligada, o seletor fica travado (*desconecte para trocar a fonte*).

**Verificado em:** ( ) aparelho físico — modelo: ______
**Resultado:** ( ) passou ( ) reprovou

## Já verificado sem o aparelho (`npm test`)

Não substitui os critérios acima, mas tira do caminho os erros de lógica antes de ir para o carro:

- `ble/protocolo.test.ts`: 118 linhas geradas pelo `leitor.py` do backend (pedaços de 20 bytes, pedaços aleatórios, CRLF, lixo no meio, firmware antigo sem extras, conexão aberta no meio de uma linha) dão o mesmo resultado no app, campo a campo.
- `ble/LeitorEsp32.test.ts`: com um BleManager de mentira, a ordem *scan → connect → retrieveServices → startNotification*, a reconexão após queda, a nova procura quando o módulo não aparece, o prazo de 10 s do connect e o Bluetooth desligado.
- `ble/FonteSimulada.test.ts`: o simulador conecta, entrega ~5 amostras/s nas faixas do `LeitorSimulado`, apaga bits de `valid`, simula a queda e volta, e para ao desligar.
