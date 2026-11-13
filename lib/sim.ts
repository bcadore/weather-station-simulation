import { ENERGY, Model, Readings, TX_INTERVAL_S } from "./specs";

export type Preset = "sol" | "nublado" | "chuva" | "frio" | "vento";

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "sol", label: "Ensolarado" },
  { key: "nublado", label: "Nublado" },
  { key: "chuva", label: "Chuva" },
  { key: "frio", label: "Frio intenso" },
  { key: "vento", label: "Vento forte" },
];

interface PresetParams {
  tMean: number;
  tAmp: number;
  hum: number;
  pressOff: number;
  wind: number;
  windVar: number;
  dir: number;
  cloud: number; // fração da luz que chega (1 = céu limpo)
  rainRate: number; // mm/h
}

const P: Record<Preset, PresetParams> = {
  sol: { tMean: 25, tAmp: 7, hum: 58, pressOff: 6, wind: 2.6, windVar: 1.2, dir: 70, cloud: 1, rainRate: 0 },
  nublado: { tMean: 20, tAmp: 3, hum: 76, pressOff: -2, wind: 3.8, windVar: 1.6, dir: 120, cloud: 0.3, rainRate: 0 },
  chuva: { tMean: 17, tAmp: 2, hum: 95, pressOff: -10, wind: 5.5, windVar: 2.8, dir: 200, cloud: 0.12, rainRate: 14 },
  frio: { tMean: 2, tAmp: 4, hum: 82, pressOff: 11, wind: 1.6, windVar: 0.8, dir: 220, cloud: 0.85, rainRate: 0 },
  vento: { tMean: 18, tAmp: 4, hum: 55, pressOff: -6, wind: 13, windVar: 5, dir: 180, cloud: 0.7, rainRate: 0 },
};

// --- Tempo -------------------------------------------------------------

export const hourOf = (t: number) => ((t / 3600) % 24 + 24) % 24;

export function sunAltitude(t: number) {
  const h = hourOf(t);
  return Math.sin((Math.PI * (h - 6)) / 12); // >0 de dia (06h–18h)
}

export function fmtClock(t: number) {
  const day = Math.floor(t / 86400) + 1;
  const s = Math.floor(t % 86400);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { day, time: `${hh}:${mm}:${ss}`, short: `${hh}:${mm}` };
}

// --- Estado ------------------------------------------------------------

export interface Phase {
  key: string;
  label: string;
  desc: string;
  dur: number; // segundos reais (antes da escala de velocidade)
}

export const PHASES: Record<Model, Phase[]> = {
  lorawan: [
    { key: "read", label: "Leitura dos sensores", desc: "O endpoint DTL-485 consulta a estação pelo cabo RS485 usando Modbus-RTU e recebe as 9 grandezas.", dur: 1.0 },
    { key: "uplink", label: "Uplink LoRaWAN", desc: "O pacote é transmitido em AU915 (LoRaWAN 1.0.3, Classe A). O gateway ao alcance recebe a mensagem.", dur: 1.2 },
    { key: "backhaul", label: "Gateway → Network Server", desc: "O gateway encaminha o pacote via IP. O Network Server (LNS) autentica, decifra e roteia para a aplicação.", dur: 1.0 },
    { key: "app", label: "Network Server → Plataforma", desc: "A aplicação recebe o payload, decodifica as leituras e atualiza o painel.", dur: 0.9 },
    { key: "rx", label: "Janelas RX1 / RX2", desc: "Classe A: depois de cada uplink o endpoint abre duas janelas curtas de recepção. É nelas que chegam os downlinks de configuração remota.", dur: 1.3 },
  ],
  nbiot: [
    { key: "read", label: "Leitura dos sensores", desc: "O endpoint DTN-485 consulta a estação pelo cabo RS485 usando Modbus-RTU e recebe as 9 grandezas.", dur: 1.0 },
    { key: "attach", label: "Conexão à rede celular", desc: "O módulo sai do modo de economia e se conecta à ERB da operadora pela rede NB-IoT (licenciada).", dur: 1.0 },
    { key: "uplink", label: "Rede da operadora", desc: "Os dados trafegam pela rede celular até o core da operadora e seguem para a internet.", dur: 0.9 },
    { key: "broker", label: "Publicação MQTT", desc: "As leituras são publicadas no broker na nuvem (MQTT/MQTTs; TCP e UDP também suportados).", dur: 0.9 },
    { key: "app", label: "Broker → Plataforma", desc: "A plataforma, assinante do tópico, recebe as leituras e atualiza o painel.", dur: 0.8 },
    { key: "dl", label: "Downlink e economia", desc: "Comandos de configuração publicados no broker são entregues ao endpoint; em seguida o módulo volta a economizar energia.", dur: 1.2 },
  ],
};

// Ritmo das animações: multiplica a duração de todas as etapas (mais alto = mais lento).
export const PACE = 2.5;

export interface LogEntry {
  id: number;
  t: number;
  model: Model;
  seq: number;
  bytes: number;
  payload: string;
  link: string;
  downlink: boolean;
}

export interface TxState {
  model: Model;
  elapsed: number; // segundos reais animados
  scale: number;
  snapshot: Readings;
  battery: number;
  delivered: boolean;
  downlink: boolean;
  dlDelivered: boolean;
  seq: number;
}

export interface SimState {
  t: number;
  preset: Preset;
  model: Model;
  r: Readings; // leitura instantânea no sensor
  gustWin: { t: number; v: number }[];
  noise: number;
  soc: number; // 0..1
  solarW: number;
  chargeW: number;
  heater: boolean;
  nextTx: number;
  tx: TxState | null;
  seq: number;
  received: Readings | null;
  receivedAt: number | null;
  history: { t: number; r: Readings }[];
  log: LogEntry[];
  dlPending: boolean;
  bleUntil: number; // segundos reais restantes
  logId: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const approach = (v: number, target: number, dt: number, tau: number) =>
  v + (target - v) * (1 - Math.exp(-dt / tau));

function targets(t: number, preset: Preset, wobble: number) {
  const p = P[preset];
  const h = hourOf(t);
  const alt = Math.max(0, sunAltitude(t));
  const temp = p.tMean + p.tAmp * Math.cos((2 * Math.PI * (h - 15)) / 24) + wobble * 0.4;
  const hum = p.hum - (temp - p.tMean) * 2.4 + wobble * 1.5;
  const press = 1013 + p.pressOff + 0.9 * Math.cos((2 * Math.PI * (h - 10)) / 12);
  const lux = Math.pow(alt, 1.25) * 112000 * p.cloud * (1 + wobble * 0.04);
  const uv = Math.pow(alt, 1.6) * 12 * Math.max(p.cloud, 0.25);
  return { temp, hum, press, lux, uv };
}

export function createSim(model: Model, startHour = 10): SimState {
  const t0 = startHour * 3600;
  const preset: Preset = "sol";
  const base = targets(t0, preset, 0);
  const r: Readings = {
    ...base,
    dir: P[preset].dir,
    speed: P[preset].wind,
    gust: P[preset].wind + 1.5,
    rain: 0,
  };
  const s: SimState = {
    t: t0,
    preset,
    model,
    r,
    gustWin: [],
    noise: 0,
    soc: 0.82,
    solarW: 0,
    chargeW: 0,
    heater: false,
    nextTx: t0 + 3,
    tx: null,
    seq: 1200,
    received: null,
    receivedAt: null,
    history: [],
    log: [],
    dlPending: false,
    bleUntil: 0,
    logId: 0,
  };
  // Histórico prévio (últimas 2 h) para o painel não começar vazio.
  for (let i = 24; i >= 1; i--) {
    const tt = t0 - i * TX_INTERVAL_S;
    const b = targets(tt, preset, Math.sin(i * 1.7));
    const pr = P[preset];
    const sp = Math.max(0, pr.wind + Math.sin(i * 2.3) * pr.windVar);
    s.history.push({
      t: tt,
      r: quantize({
        ...b,
        dir: (pr.dir + Math.sin(i) * 25 + 360) % 360,
        speed: sp,
        gust: sp + 1 + Math.abs(Math.sin(i * 3.1)) * pr.windVar,
        rain: 0,
      }),
    });
  }
  s.received = s.history[s.history.length - 1].r;
  s.receivedAt = s.history[s.history.length - 1].t;
  return s;
}

export function quantize(r: Readings): Readings {
  return {
    temp: Math.round(clamp(r.temp, -40, 60) * 10) / 10,
    hum: Math.round(clamp(r.hum, 1, 99)),
    press: Math.round(clamp(r.press, 300, 1100) * 10) / 10,
    lux: Math.round(clamp(r.lux, 0, 200000) / 100) * 100,
    uv: Math.round(clamp(r.uv, 0, 15)),
    dir: Math.round(((r.dir % 360) + 360) % 360) % 360,
    speed: r.speed < 0.5 ? 0 : Math.round(clamp(r.speed, 0, 40) * 10) / 10,
    gust: r.gust < 0.5 ? 0 : Math.round(clamp(r.gust, 0, 40) * 10) / 10,
    rain: Math.round(clamp(r.rain, 0, 6553.5) * 10) / 10,
  };
}

export function phaseAt(tx: TxState) {
  const phases = PHASES[tx.model];
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const d = phases[i].dur * PACE * tx.scale;
    if (tx.elapsed < acc + d) return { index: i, phase: phases[i], p: (tx.elapsed - acc) / d };
    acc += d;
  }
  return null;
}

export function totalDur(model: Model) {
  return PHASES[model].reduce((a, p) => a + p.dur * PACE, 0);
}

export function startTx(s: SimState, speed: number) {
  const realInterval = TX_INTERVAL_S / speed;
  const scale = Math.min(1, (realInterval * 0.85) / totalDur(s.model));
  s.seq += 1;
  s.tx = {
    model: s.model,
    elapsed: 0,
    scale,
    snapshot: quantize(s.r),
    battery: s.soc,
    delivered: false,
    downlink: s.dlPending,
    dlDelivered: false,
    seq: s.seq,
  };
  s.nextTx = s.t + TX_INTERVAL_S;
}

// --- Payload ilustrativo -------------------------------------------------

function hex(n: number, bytes: number) {
  const v = Math.round(n) & (bytes === 1 ? 0xff : 0xffff);
  return v.toString(16).padStart(bytes * 2, "0").toUpperCase();
}

export function encodeLoRa(r: Readings, battery: number) {
  const parts = [
    hex(r.temp * 10 < 0 ? 0x10000 + r.temp * 10 : r.temp * 10, 2),
    hex(r.hum, 1),
    hex(r.press * 10 - 3000, 2),
    hex(r.lux / 100, 2),
    hex(r.uv, 1),
    hex(r.dir, 2),
    hex(r.speed * 10, 2),
    hex(r.gust * 10, 2),
    hex(r.rain * 10, 2),
    hex(battery * 100, 1),
  ];
  const s = parts.join("");
  return { hex: s.match(/.{2}/g)!.join(" "), bytes: s.length / 2 };
}

export function encodeJson(r: Readings, battery: number, seq: number) {
  const obj = {
    seq,
    temp: r.temp,
    hum: r.hum,
    press: r.press,
    lux: r.lux,
    uv: r.uv,
    wdir: r.dir,
    wspd: r.speed,
    gust: r.gust,
    rain: r.rain,
    bat: Math.round(battery * 100),
  };
  const s = JSON.stringify(obj);
  return { json: s, bytes: s.length };
}

// --- Passo da simulação --------------------------------------------------

export function step(s: SimState, realDt: number, speed: number) {
  if (!(realDt > 0)) return;
  const dt = realDt * speed; // segundos simulados
  s.t += dt;
  const p = P[s.preset];

  s.noise = clamp(s.noise + (Math.random() - 0.5) * Math.sqrt(dt) * 0.08, -1, 1);
  const tg = targets(s.t, s.preset, s.noise);
  s.r.temp = approach(s.r.temp, tg.temp, dt, 250);
  s.r.hum = approach(s.r.hum, tg.hum, dt, 250);
  s.r.press = approach(s.r.press, tg.press, dt, 600);
  s.r.lux = approach(s.r.lux, tg.lux, dt, 60);
  s.r.uv = approach(s.r.uv, tg.uv, dt, 80);

  // Vento: amostragem a cada 2 s, rajada = máximo nos últimos 28 s.
  const inst = Math.max(0, p.wind + (Math.random() - 0.5) * 2 * p.windVar + s.noise * p.windVar);
  s.r.speed = approach(s.r.speed, inst, dt, 6);
  s.gustWin.push({ t: s.t, v: s.r.speed * (1 + Math.random() * 0.35) });
  s.gustWin = s.gustWin.filter((g) => s.t - g.t <= 28);
  s.r.gust = Math.max(s.r.speed, ...s.gustWin.map((g) => g.v));
  const dirTarget = p.dir + s.noise * 30;
  let dd = ((dirTarget - s.r.dir + 540) % 360) - 180;
  dd += (Math.random() - 0.5) * 20;
  s.r.dir = (s.r.dir + dd * (1 - Math.exp(-dt / 60)) + 360) % 360;

  if (p.rainRate > 0) {
    const rate = p.rainRate * (0.6 + 0.4 * Math.sin(s.t / 900) + s.noise * 0.3);
    s.r.rain += (Math.max(0, rate) * dt) / 3600;
  }

  // Termostato de degelo: atua entre 0 °C e +10 °C (datasheet).
  s.heater = s.r.temp <= 10;

  // Energia
  s.solarW = ENERGY.panelMaxW * Math.min(1, s.r.lux / 112000) * 0.95;
  const full = s.soc >= 0.999;
  const usable = full ? Math.min(s.solarW, ENERGY.avgLoadW) : s.solarW * 0.85; // PWM limita quando cheia
  s.chargeW = usable - ENERGY.avgLoadW;
  s.soc = clamp(s.soc + (s.chargeW * dt) / 3600 / ENERGY.batteryWh, 0, 1);

  if (s.bleUntil > 0) s.bleUntil = Math.max(0, s.bleUntil - realDt);

  // Transmissão
  if (!s.tx && s.t >= s.nextTx) startTx(s, speed);
  if (s.tx) {
    s.tx.elapsed += realDt;
    const ph = phaseAt(s.tx);
    const appIdx = PHASES[s.tx.model].findIndex((x) => x.key === "app");
    if (!s.tx.delivered && (!ph || ph.index > appIdx)) deliver(s);
    if (s.tx.downlink && !s.tx.dlDelivered && !ph) {
      s.tx.dlDelivered = true;
      s.dlPending = false;
    }
    if (!ph) s.tx = null;
  }
}

function deliver(s: SimState) {
  const tx = s.tx!;
  tx.delivered = true;
  const r = tx.snapshot;
  s.received = r;
  s.receivedAt = s.t;
  s.history.push({ t: s.t, r });
  if (s.history.length > 40) s.history.shift();
  let payload: string;
  let bytes: number;
  let link: string;
  if (tx.model === "lorawan") {
    const e = encodeLoRa(r, tx.battery);
    payload = e.hex;
    bytes = e.bytes;
    const rssi = -(92 + Math.round(Math.random() * 18));
    const snr = (Math.random() * 9 - 1).toFixed(1);
    link = `FCnt ${tx.seq} · 1 gateway · RSSI ${rssi} dBm · SNR ${snr} dB`;
  } else {
    const e = encodeJson(r, tx.battery, tx.seq);
    payload = e.json;
    bytes = e.bytes;
    const rsrp = -(85 + Math.round(Math.random() * 25));
    const sinr = (Math.random() * 12 + 1).toFixed(1);
    link = `MQTT QoS 1 · RSRP ${rsrp} dBm · SINR ${sinr} dB`;
  }
  s.logId += 1;
  s.log.unshift({ id: s.logId, t: s.t, model: tx.model, seq: tx.seq, bytes, payload, link, downlink: tx.downlink });
  if (s.log.length > 30) s.log.pop();
}
