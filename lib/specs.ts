// Dados extraídos dos datasheets DTL-485 e DTN-485 (PT v1).

export type ReadingKey =
  | "temp"
  | "hum"
  | "press"
  | "lux"
  | "uv"
  | "dir"
  | "speed"
  | "gust"
  | "rain";

export type Readings = Record<ReadingKey, number>;

export interface SensorSpec {
  key: ReadingKey;
  label: string;
  unit: string;
  range: string;
  accuracy: string;
  resolution: string;
  decimals: number;
  sensor: string;
}

export const SENSORS: SensorSpec[] = [
  {
    key: "temp",
    label: "Temperatura",
    unit: "°C",
    range: "-40 °C a +60 °C",
    accuracy: "±1 °C",
    resolution: "0,1 °C",
    decimals: 1,
    sensor: "Termo-higrômetro-barômetro",
  },
  {
    key: "hum",
    label: "Umidade relativa",
    unit: "%",
    range: "1% a 99%",
    accuracy: "±5%",
    resolution: "1%",
    decimals: 0,
    sensor: "Termo-higrômetro-barômetro",
  },
  {
    key: "press",
    label: "Pressão atmosférica",
    unit: "hPa",
    range: "300 a 1100 hPa",
    accuracy: "±5 hPa",
    resolution: "0,1 hPa",
    decimals: 1,
    sensor: "Termo-higrômetro-barômetro",
  },
  {
    key: "lux",
    label: "Iluminância solar",
    unit: "lx",
    range: "0 a 200.000 lx",
    accuracy: "±25%",
    resolution: "100 lx",
    decimals: 0,
    sensor: "Luxímetro",
  },
  {
    key: "uv",
    label: "Índice UV",
    unit: "IUV",
    range: "1 a 15 IUV",
    accuracy: "±2 IUV",
    resolution: "1 IUV",
    decimals: 0,
    sensor: "Sensor de radiação UV",
  },
  {
    key: "dir",
    label: "Direção do vento",
    unit: "°",
    range: "0° a 359°",
    accuracy: "±15°",
    resolution: "1°",
    decimals: 0,
    sensor: "Anemômetro ultrassônico",
  },
  {
    key: "speed",
    label: "Velocidade do vento",
    unit: "m/s",
    range: "0 a 40 m/s (partida 0,5 m/s)",
    accuracy: "±1 m/s (<10) · ±10% (≥10)",
    resolution: "0,1 m/s · intervalo 2 s",
    decimals: 1,
    sensor: "Anemômetro ultrassônico",
  },
  {
    key: "gust",
    label: "Rajada do vento",
    unit: "m/s",
    range: "0 a 40 m/s",
    accuracy: "±20% (<10) · ±10% (≥10)",
    resolution: "0,1 m/s · máx. em 28 s",
    decimals: 1,
    sensor: "Anemômetro ultrassônico",
  },
  {
    key: "rain",
    label: "Chuva acumulada",
    unit: "mm",
    range: "0 a 6553,5 mm",
    accuracy: "±10% (5–49 mm/h) · ±20% demais",
    resolution: "0,1 mm",
    decimals: 1,
    sensor: "Pluviômetro piezoelétrico",
  },
];

export type Model = "lorawan" | "nbiot";

export interface EndpointSpec {
  name: string;
  tech: string;
  rows: [string, string][];
}

export const ENDPOINTS: Record<Model, EndpointSpec> = {
  lorawan: {
    name: "DTL-485",
    tech: "LoRaWAN",
    rows: [
      ["Protocolo", "LoRaWAN 1.0.3 · Classe A"],
      ["Frequência", "AU915"],
      ["Conexão com a estação", "RS485 · Modbus-RTU"],
      ["Intervalo de transmissão", "5 minutos"],
      ["Alimentação", "3,6 V (via PWM + step-down)"],
      ["Configuração local", "BLE (app DT KONFIG)"],
      ["Configuração remota", "Downlink via LNS"],
    ],
  },
  nbiot: {
    name: "DTN-485",
    tech: "NB-IoT",
    rows: [
      ["Bandas NB-IoT", "B1, B2, B3, B4, B5, B8, B12, B13, B17, B18, B19, B20, B25, B28, B66, B70, B85 (H-FDD)"],
      ["Uplink de dados", "MQTT, MQTTs, TCP e UDP"],
      ["Conexão com a estação", "RS485 · Modbus-RTU"],
      ["Intervalo de transmissão", "5 minutos"],
      ["Alimentação", "3,6 V (via PWM + step-down)"],
      ["Configuração local", "BLE (app DT KONFIG)"],
      ["Configuração remota", "Downlink via broker MQTT"],
    ],
  },
};

// Energia (datasheet): painel SA10-36P 10 W / 19 V / 0,53 A, controlador PWM ECP 1024,
// bateria XB 1270 12 V 7 Ah, autonomia de até 1 semana.
export const ENERGY = {
  panelMaxW: 10,
  panelVmp: 19,
  panelImp: 0.53,
  batteryV: 12,
  batteryAh: 7,
  batteryWh: 84,
  autonomyHours: 168,
  // Consumo médio derivado da autonomia declarada: 84 Wh / 168 h ≈ 0,5 W.
  avgLoadW: 84 / 168,
};

export const TX_INTERVAL_S = 5 * 60;
