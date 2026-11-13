# Simulação · Estação Meteorológica KHOMP

Simulação ilustrativa, animada, do funcionamento das estações **DTL-485 (LoRaWAN)** e **DTN-485 (NB-IoT)**:
sensores medindo as 9 grandezas, energia solar e bateria, leitura via RS485/Modbus-RTU e o caminho
dos dados até a plataforma em cada tecnologia.

## Como rodar

Requisito: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

Para a apresentação, prefira a versão otimizada (mais fluida):

```bash
npm run build
npm start
```

## Como usar na apresentação

- **DTL-485 / DTN-485** (canto superior direito): alterna entre LoRaWAN e NB-IoT.
- **Clima**: Ensolarado, Nublado, Chuva (chuva acumulada sobe), Frio intenso (liga o aquecedor de degelo) e Vento forte.
- **Horário**: pula para amanhecer, meio-dia, entardecer ou noite (painel solar deixa de gerar e a bateria assume).
- **Velocidade**: 5× (um envio por minuto), 10× (padrão, a cada 30 s), 20× (a cada 15 s) ou 60× (a cada 5 s, com a animação comprimida). Pausar congela a cena.
- Para deixar as animações de cada etapa ainda mais lentas ou mais rápidas, ajuste `PACE` em `lib/sim.ts` (padrão 2,5).
- **Transmitir agora**: dispara um envio imediato, sem esperar o ciclo de 5 minutos.
- **Config. remota**: agenda um downlink. Ele é entregue após o próximo uplink (janelas RX1/RX2 no LoRaWAN; via broker no NB-IoT).
- **Config. BLE**: mostra a configuração local pelo app DT KONFIG.
- **Rótulos**: liga/desliga os nomes dos componentes da estação.

## O que vem dos datasheets e o que é simulado

Vêm dos datasheets (PT v1): faixas, resoluções e acurácias dos sensores, intervalo de 5 minutos,
RS485/Modbus-RTU, LoRaWAN 1.0.3 Classe A em AU915, bandas NB-IoT e protocolos MQTT/MQTTs/TCP/UDP,
painel de 10 W, bateria 12 V 7 Ah e termostato de degelo (0 °C a +10 °C).

São simulados: os valores meteorológicos. A cena mostra o fluxo de energia (painel → PWM → bateria →
endpoint) apenas de forma visual, sem números de consumo ou autonomia, até termos os valores oficiais.

## Estrutura

- `lib/specs.ts`: dados dos datasheets.
- `lib/sim.ts`: modelo do clima, da energia, das etapas de transmissão e dos payloads.
- `components/Scene.tsx`: cena animada em SVG (estação, gabinete, rede LoRaWAN/NB-IoT).
- `components/Simulator.tsx`: controles, etapas, painel de leituras, endpoint e comparativo.
