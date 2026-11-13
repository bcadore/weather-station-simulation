"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Scene from "./Scene";
import Sparkline from "./Sparkline";
import {
  createSim,
  fmtClock,
  phaseAt,
  PHASES,
  Preset,
  PRESETS,
  SimState,
  startTx,
  step,
} from "@/lib/sim";
import { ENDPOINTS, Model, SENSORS, TX_INTERVAL_S } from "@/lib/specs";

const SPEEDS = [
  { v: 5, label: "5×", hint: "um envio por minuto" },
  { v: 10, label: "10×", hint: "um envio a cada 30 s" },
  { v: 20, label: "20×", hint: "um envio a cada 15 s" },
  { v: 60, label: "60×", hint: "um envio a cada 5 s (animação acelerada)" },
];

const JUMPS = [
  { h: 6.5, label: "Amanhecer" },
  { h: 12, label: "Meio-dia" },
  { h: 17.5, label: "Entardecer" },
  { h: 22, label: "Noite" },
];

const fmt = (v: number, d: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function compass(deg: number) {
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function Simulator() {
  const sim = useRef<SimState>(createSim("lorawan"));
  const [, setFrame] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [labels, setLabels] = useState(true);
  const lastDelivery = useRef<{ id: number; at: number }>({ id: 0, at: -10 });
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  runningRef.current = running;
  speedRef.current = speed;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (runningRef.current) step(sim.current, dt, speedRef.current);
      acc += dt;
      if (acc > 1 / 40) {
        acc = 0;
        setFrame((f) => (f + 1) % 1e6);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = sim.current;
  const now = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  if (s.log[0] && s.log[0].id !== lastDelivery.current.id) lastDelivery.current = { id: s.log[0].id, at: now };
  const flash = Math.max(0, 1 - (now - lastDelivery.current.at) / 5);

  const setModel = useCallback((m: Model) => {
    const st = sim.current;
    if (st.model === m) return;
    st.model = m;
    st.tx = null;
    st.nextTx = st.t + 2 * speedRef.current; // ~2 s reais
  }, []);
  const setPreset = (p: Preset) => {
    sim.current.preset = p;
    setFrame((f) => f + 1);
  };
  const jump = (h: number) => {
    const st = sim.current;
    const dayStart = Math.floor(st.t / 86400) * 86400;
    let t = dayStart + h * 3600;
    if (t < st.t) t += 86400;
    st.t = t;
    st.gustWin = [];
    st.nextTx = t + 2 * speedRef.current;
    st.tx = null;
  };
  const txNow = () => {
    const st = sim.current;
    if (!st.tx) startTx(st, speedRef.current);
  };
  const sendDownlink = () => {
    sim.current.dlPending = true;
    setFrame((f) => f + 1);
  };
  const ble = () => {
    sim.current.bleUntil = 4;
  };

  const ph = s.tx ? phaseAt(s.tx) : null;
  const phases = PHASES[s.model];
  const clock = fmtClock(s.t);
  const nextIn = Math.max(0, s.nextTx - s.t);
  const ep = ENDPOINTS[s.model];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/khomp-logo.png" alt="KHOMP" className="logo" />
          <div>
            <h1>Estação Meteorológica · Simulação</h1>
            <p>Funcionamento e fluxo de dados das versões LoRaWAN (DTL-485) e NB-IoT (DTN-485)</p>
          </div>
        </div>
        <div className="seg big" role="tablist" aria-label="Modelo">
          {(["lorawan", "nbiot"] as Model[]).map((m) => (
            <button key={m} role="tab" aria-selected={s.model === m} className={s.model === m ? "on" : ""} onClick={() => setModel(m)}>
              <strong>{ENDPOINTS[m].name}</strong>
              <span>{ENDPOINTS[m].tech}</span>
            </button>
          ))}
        </div>
      </header>

      <main>
        <section className="toolbar">
          <div className="group">
            <span className="glabel">Clima</span>
            <div className="seg">
              {PRESETS.map((p) => (
                <button key={p.key} className={s.preset === p.key ? "on" : ""} onClick={() => setPreset(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <span className="glabel">Horário</span>
            <div className="seg">
              {JUMPS.map((j) => (
                <button key={j.label} onClick={() => jump(j.h)}>
                  {j.label}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <span className="glabel">Velocidade</span>
            <div className="seg">
              <button className={running ? "" : "on"} onClick={() => setRunning((r) => !r)} aria-label={running ? "Pausar" : "Continuar"}>
                {running ? "❚❚ Pausar" : "▶ Continuar"}
              </button>
              {SPEEDS.map((sp) => (
                <button key={sp.v} className={speed === sp.v ? "on" : ""} onClick={() => setSpeed(sp.v)} title={sp.hint}>
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <span className="glabel">Ações</span>
            <div className="seg">
              <button onClick={txNow} disabled={!!s.tx}>Transmitir agora</button>
              <button onClick={sendDownlink} disabled={s.dlPending} title="Configuração remota">
                {s.dlPending ? "Downlink pendente…" : "Config. remota"}
              </button>
              <button onClick={ble}>Config. BLE</button>
              <button className={labels ? "on" : ""} onClick={() => setLabels((l) => !l)}>
                Rótulos
              </button>
            </div>
          </div>
        </section>

        <section className="stage card">
          <div className="hud">
            <div className="hud-item">
              <span>Dia {clock.day}</span>
              <strong className="mono">{clock.time}</strong>
            </div>
            <div className="hud-item">
              <span>Próximo envio</span>
              <strong className="mono">
                {s.tx ? "transmitindo…" : `${String(Math.floor(nextIn / 60)).padStart(2, "0")}:${String(Math.floor(nextIn % 60)).padStart(2, "0")}`}
              </strong>
            </div>
            <div className="hud-item">
              <span>Intervalo</span>
              <strong>5 min</strong>
            </div>
            <div className="hud-bar">
              <div style={{ width: `${(1 - nextIn / TX_INTERVAL_S) * 100}%` }} />
            </div>
          </div>
          <Scene s={s} labels={labels} flash={flash} />
        </section>

        <section className="steps card">
          {phases.map((p, i) => {
            const state = ph ? (i < ph.index ? "done" : i === ph.index ? "now" : "") : "";
            return (
              <div key={p.key} className={`step ${state}`}>
                <div className="step-n">{i + 1}</div>
                <div>
                  <div className="step-t">{p.label}</div>
                  <div className="step-d">{p.desc}</div>
                </div>
                {state === "now" && <div className="step-prog" style={{ width: `${ph!.p * 100}%` }} />}
              </div>
            );
          })}
        </section>

        <div className="grid">
          <section className="card">
            <div className="card-h">
              <h2>Painel da plataforma</h2>
              <span className="muted">
                Último pacote recebido às {s.receivedAt != null ? fmtClock(s.receivedAt).short : "--:--"} · valores no sensor atualizam em tempo real
              </span>
            </div>
            <div className="readings">
              {SENSORS.map((sp) => {
                const v = s.received?.[sp.key];
                const live = s.r[sp.key];
                return (
                  <div key={sp.key} className={`reading${flash > 0.6 ? " fresh" : ""}`}>
                    <div className="r-top">
                      <span className="r-label">{sp.label}</span>
                      <span className="r-sensor">{sp.sensor}</span>
                    </div>
                    <div className="r-val">
                      {v != null ? fmt(v, sp.decimals) : "—"}
                      <small>{sp.unit}</small>
                      {sp.key === "dir" && v != null && <em>{compass(v)}</em>}
                    </div>
                    <Sparkline values={s.history.map((x) => x.r[sp.key])} />
                    <div className="r-foot">
                      <span>no sensor agora: {fmt(sp.key === "lux" ? Math.round(live / 100) * 100 : live, sp.decimals)}</span>
                      <span title={`Faixa ${sp.range} · Resolução ${sp.resolution}`}>{sp.accuracy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="side">
            <section className="card endpoint-card">
              <div className="card-h">
                <h2>Endpoint {ep.name}</h2>
                <span className="pill teal">{ep.tech}</span>
              </div>
              <dl className="spec">
                {ep.rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>

          <section className="card">
            <div className="card-h">
              <h2>LoRaWAN × NB-IoT</h2>
            </div>
            <table className="cmp">
              <thead>
                <tr>
                  <th></th>
                  <th className={s.model === "lorawan" ? "sel" : ""}>DTL-485 · LoRaWAN</th>
                  <th className={s.model === "nbiot" ? "sel" : ""}>DTN-485 · NB-IoT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rede</td>
                  <td>Gateways próprios ou de parceiros</td>
                  <td>Rede celular da operadora</td>
                </tr>
                <tr>
                  <td>Espectro</td>
                  <td>AU915 (não licenciado)</td>
                  <td>Bandas licenciadas B1 a B85</td>
                </tr>
                <tr>
                  <td>Caminho dos dados</td>
                  <td>Gateway → Network Server → Plataforma</td>
                  <td>ERB → Core → Broker MQTT → Plataforma</td>
                </tr>
                <tr>
                  <td>Formato de envio</td>
                  <td>Uplink LoRaWAN 1.0.3, Classe A</td>
                  <td>MQTT, MQTTs, TCP ou UDP</td>
                </tr>
                <tr>
                  <td>Config. remota</td>
                  <td>Downlink via LNS (janelas RX)</td>
                  <td>Downlink via broker</td>
                </tr>
                <tr>
                  <td>Em comum</td>
                  <td colSpan={2}>9 grandezas · RS485/Modbus-RTU · envio a cada 5 min · solar + bateria · BLE via DT KONFIG</td>
                </tr>
              </tbody>
            </table>
          </section>

        <footer className="foot">
          Simulação ilustrativa para apresentação. Especificações dos datasheets DTL-485 e DTN-485 (PT v1); os valores meteorológicos são simulados.
        </footer>
      </main>
    </div>
  );
}
