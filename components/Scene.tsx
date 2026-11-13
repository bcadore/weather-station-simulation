"use client";

import { ReactNode } from "react";
import { hourOf, phaseAt, SimState, sunAltitude } from "@/lib/sim";
import { ENDPOINTS } from "@/lib/specs";

type Pt = { x: number; y: number };

const ANT: Pt = { x: 372, y: 252 };
const HEAD: Pt = { x: 194, y: 198 };
const EP: Pt = { x: 300, y: 407 };
// Trajeto do cabo RS485: endpoint (no gabinete) → descendo/subindo pelo poste → estação.
const CABLE: Pt[] = [EP, { x: 240, y: 400 }, { x: 186, y: 366 }, { x: 181, y: 290 }, { x: 184, y: 226 }, HEAD];
const DY = -40; // gabinete fixado no poste, acima do solo

const LORA = {
  g1: { x: 610, y: 250 },
  lns: { x: 860, y: 300 },
  app: { x: 1080, y: 300 },
};
const NB = {
  tower: { x: 600, y: 236 },
  towerBase: { x: 600, y: 500 },
  core: { x: 790, y: 330 },
  broker: { x: 945, y: 215 },
  app: { x: 1080, y: 330 },
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function mixColor(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((v, i) => Math.round(lerp(v, pb[i], k)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function along(pts: Pt[], p: number): Pt {
  const segs = pts.slice(1).map((b, i) => Math.hypot(b.x - pts[i].x, b.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = clamp01(p) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] === 0 ? 0 : Math.min(1, d / segs[i]);
      return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) };
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function Packet({ at, down = false, label }: { at: Pt; down?: boolean; label?: string }) {
  const c = down ? "var(--orange)" : "var(--green)";
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <circle r={13} fill={c} opacity={0.25} />
      <rect x={-9} y={-6} width={18} height={12} rx={3} fill={c} stroke="#fff" strokeWidth={1.5} />
      <path d="M-6 -3 L0 1 L6 -3" stroke="#fff" strokeWidth={1.3} fill="none" />
      {label && (
        <text y={-17} textAnchor="middle" className="pkt-label">
          {label}
        </text>
      )}
    </g>
  );
}

function Rings({ c, p, max, color }: { c: Pt; p: number; max: number; color: string }) {
  return (
    <g clipPath="url(#rightOfAnt)">
      {[0, 0.33, 0.66].map((off) => {
        const k = (p + off) % 1;
        return (
          <circle
            key={off}
            cx={c.x}
            cy={c.y}
            r={10 + k * max}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            opacity={(1 - k) * 0.85}
          />
        );
      })}
    </g>
  );
}

function NodeLabel({ x, y, title, sub, active }: { x: number; y: number; title: string; sub?: string; active?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text textAnchor="middle" className={`node-title${active ? " active" : ""}`}>
        {title}
      </text>
      {sub && (
        <text y={15} textAnchor="middle" className="node-sub">
          {sub}
        </text>
      )}
    </g>
  );
}

function Gateway({ at, active }: { at: Pt; active: boolean }) {
  return (
    <g>
      <line x1={at.x} y1={at.y + 18} x2={at.x} y2={at.y + 120} stroke="#5E7378" strokeWidth={5} />
      <line x1={at.x - 22} y1={at.y + 120} x2={at.x} y2={at.y + 60} stroke="#5E7378" strokeWidth={2} />
      <line x1={at.x + 22} y1={at.y + 120} x2={at.x} y2={at.y + 60} stroke="#5E7378" strokeWidth={2} />
      <rect x={at.x - 15} y={at.y + 14} width={30} height={22} rx={4} fill={active ? "var(--teal)" : "#F4F6F6"} stroke="var(--navy)" strokeWidth={2} />
      <line x1={at.x} y1={at.y + 14} x2={at.x} y2={at.y - 14} stroke="var(--navy)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={at.x} cy={at.y - 14} r={3} fill="var(--navy)" />
      <circle cx={at.x + 9} cy={at.y + 25} r={2.5} fill={active ? "var(--green)" : "#9fb0b4"} />
    </g>
  );
}

function Building({ x, y }: { x: number; y: number }) {
  const wins: ReactNode[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++)
      wins.push(<rect key={`${r}-${c}`} x={x + 10 + c * 20} y={y + 12 + r * 24} width={10} height={12} rx={1} fill="#CFE5E6" opacity={0.85} />);
  return (
    <g>
      <rect x={x} y={y} width={76} height={520 - y} fill="#3E5A61" />
      {wins}
    </g>
  );
}

function Server({ at, active, label }: { at: Pt; active: boolean; label: string }) {
  return (
    <g>
      <rect x={at.x - 34} y={at.y - 44} width={68} height={88} rx={8} fill="var(--navy)" stroke={active ? "var(--green)" : "#0A5A64"} strokeWidth={active ? 3 : 2} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={at.x - 26} y={at.y - 36 + i * 27} width={52} height={20} rx={3} fill="#13808C" opacity={0.35} />
          <circle cx={at.x + 17} cy={at.y - 26 + i * 27} r={3} fill={active ? "var(--green)" : "#6d8a90"} />
          <line x1={at.x - 20} y1={at.y - 26 + i * 27} x2={at.x + 6} y2={at.y - 26 + i * 27} stroke="#EDF5F3" strokeWidth={2} opacity={0.5} />
        </g>
      ))}
      <text x={at.x} y={at.y + 4} textAnchor="middle" className="node-glyph">
        {label}
      </text>
    </g>
  );
}

function Cloud({ at, active }: { at: Pt; active: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <path
        d="M-48 18 Q-60 18 -60 4 Q-60 -12 -42 -12 Q-38 -34 -14 -32 Q2 -46 22 -32 Q46 -34 46 -10 Q62 -8 60 8 Q58 18 46 18 Z"
        fill="#fff"
        stroke={active ? "var(--green)" : "var(--teal)"}
        strokeWidth={active ? 3 : 2}
      />
      <text y={6} textAnchor="middle" className="node-glyph dark">
        MQTT
      </text>
    </g>
  );
}

function Monitor({ at, flash, received }: { at: Pt; flash: number; received: boolean }) {
  return (
    <g>
      <rect x={at.x - 62} y={at.y - 46} width={124} height={84} rx={6} fill="var(--navy)" stroke={flash > 0 ? "var(--green)" : "#0A5A64"} strokeWidth={flash > 0 ? 3 : 2} />
      <rect x={at.x - 54} y={at.y - 38} width={108} height={68} rx={3} fill={mixColor("#0E3A42", "#13808C", 0.35 + flash * 0.4)} />
      {received &&
        [14, 26, 20, 34, 28, 40].map((h, i) => (
          <rect key={i} x={at.x - 46 + i * 15} y={at.y + 22 - h} width={9} height={h} rx={1.5} fill={i === 5 ? "var(--green)" : "#EDF5F3"} opacity={0.8} />
        ))}
      <path d={`M${at.x - 46} ${at.y - 26} L${at.x - 20} ${at.y - 30} L${at.x + 4} ${at.y - 22} L${at.x + 46} ${at.y - 32}`} stroke="var(--orange)" strokeWidth={2} fill="none" />
      <rect x={at.x - 8} y={at.y + 38} width={16} height={12} fill="#5E7378" />
      <rect x={at.x - 30} y={at.y + 50} width={60} height={5} rx={2} fill="#5E7378" />
    </g>
  );
}

function Tower({ top, active }: { top: Pt; active: boolean }) {
  const b = 500;
  return (
    <g stroke="#5E7378" strokeWidth={2.5} fill="none">
      <path d={`M${top.x - 6} ${top.y + 20} L${top.x - 34} ${b} M${top.x + 6} ${top.y + 20} L${top.x + 34} ${b}`} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y1 = top.y + 20 + i * ((b - top.y - 20) / 6);
        const y2 = top.y + 20 + (i + 1) * ((b - top.y - 20) / 6);
        const w1 = 6 + (28 * (y1 - top.y - 20)) / (b - top.y - 20);
        const w2 = 6 + (28 * (y2 - top.y - 20)) / (b - top.y - 20);
        return <path key={i} d={`M${top.x - w1} ${y1} L${top.x + w2} ${y2} M${top.x + w1} ${y1} L${top.x - w2} ${y2}`} strokeWidth={1.4} />;
      })}
      <rect x={top.x - 14} y={top.y - 8} width={8} height={30} fill={active ? "var(--teal)" : "#F4F6F6"} stroke="var(--navy)" strokeWidth={1.5} />
      <rect x={top.x + 6} y={top.y - 8} width={8} height={30} fill={active ? "var(--teal)" : "#F4F6F6"} stroke="var(--navy)" strokeWidth={1.5} />
      <line x1={top.x} y1={top.y - 30} x2={top.x} y2={top.y + 20} stroke="var(--navy)" strokeWidth={3} />
      <circle cx={top.x} cy={top.y - 32} r={3.5} fill="#E04A3F" stroke="none" />
    </g>
  );
}

function Link({ a, b, active, dashed }: { a: Pt; b: Pt; active?: boolean; dashed?: boolean }) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      className={active ? "link active" : "link"}
      strokeDasharray={dashed ? "6 6" : undefined}
    />
  );
}

export default function Scene({ s, labels, flash }: { s: SimState; labels: boolean; flash: number }) {
  const h = hourOf(s.t);
  const alt = sunAltitude(s.t);
  const day = clamp01(alt * 3 + 0.35);
  const cloudy = { sol: 0, nublado: 0.6, chuva: 0.85, frio: 0.25, vento: 0.3 }[s.preset];
  const skyTop = mixColor(mixColor("#06171D", "#7EC4D0", day), "#7C8F94", cloudy * day);
  const skyBot = mixColor(mixColor("#0E3A42", "#E4F3F1", day), "#C3CFD2", cloudy * day);
  const ground = mixColor("#1F3A22", "#6AAE3E", day * (1 - cloudy * 0.3));
  const ground2 = mixColor("#152B18", "#4F8C2E", day * (1 - cloudy * 0.3));

  const sunS = (h - 6) / 12;
  const sun = { x: 80 + 1040 * sunS, y: 520 - 450 * Math.sin(Math.PI * clamp01(sunS)) };
  const moonS = (((h - 18) % 24) + 24) % 24 / 12;
  const moon = { x: 80 + 1040 * moonS, y: 520 - 380 * Math.sin(Math.PI * clamp01(moonS)) };

  const ph = s.tx ? phaseAt(s.tx) : null;
  const key = ph?.phase.key;
  const p = ph?.p ?? 0;
  const model = s.model;
  const txModel = s.tx?.model ?? model;
  const live = s.tx && txModel === model ? key : undefined;
  const dl = s.tx?.downlink ?? false;

  const panelCenter = { x: 282, y: 252 };
  // Sem sol (noite, chuva ou céu totalmente nublado) o painel não gera: a bateria alimenta o sistema.
  const noSunWeather = s.preset === "chuva" || s.preset === "nublado";
  const solarOn = alt > 0.08 && !noSunWeather;
  const solarK = solarOn ? clamp01(s.solarW / 9) : 0;
  const charging = solarOn;
  const energyReason = alt <= 0.08 ? "noite" : s.preset === "chuva" ? "chuva" : "céu encoberto";

  // Endpoint status
  let epStatus = model === "lorawan" ? "Em espera (sleep)" : "Modo de economia (PSM)";
  if (live === "read") epStatus = "Lendo sensores (Modbus)";
  else if (live === "uplink" && model === "lorawan") epStatus = "Transmitindo (TX)";
  else if (live === "attach") epStatus = "Conectando à rede";
  else if (live === "uplink" || live === "broker" || live === "app") epStatus = model === "lorawan" ? "Em espera (sleep)" : "Conectado · TX";
  else if (live === "rx") epStatus = p < 0.5 ? "Janela RX1 aberta" : "Janela RX2 aberta";
  else if (live === "dl") epStatus = dl ? "Recebendo configuração" : "Aguardando downlink";
  if (live === "backhaul" || (model === "lorawan" && live === "app")) epStatus = "Em espera (sleep)";

  // Sequência de leitura dos sensores (realce)
  const readK = live === "read" ? p : -1;
  const hl = (from: number, to: number) => readK >= from && readK < to;

  const rainOn = s.preset === "chuva";
  const windOn = s.r.speed > 1.2;
  const windDur = Math.max(0.35, 4 / Math.max(1, s.r.speed));

  const cloudsN = { sol: 1, nublado: 5, chuva: 6, frio: 2, vento: 3 }[s.preset];
  const drift = (s.t / 40) % 1400;

  const ep = ENDPOINTS[model];
  const appPt = model === "lorawan" ? LORA.app : NB.app;

  return (
    <svg viewBox="0 0 1200 600" className={`scene${day < 0.5 ? " night" : ""}`} role="img" aria-label="Simulação da estação meteorológica e do fluxo de dados">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBot} />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ground} />
          <stop offset="1" stopColor={ground2} />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stopColor="#FFF4C2" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFD86B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatGlow">
          <stop offset="0" stopColor="#FF6A3D" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </radialGradient>
        <clipPath id="rightOfAnt">
          <rect x={ANT.x - 6} y={0} width={900} height={520} />
        </clipPath>
        <clipPath id="battClip">
          <rect x={240} y={482} width={116} height={38} rx={4} />
        </clipPath>
      </defs>

      {/* Céu */}
      <rect width={1200} height={600} fill="url(#sky)" />
      <g opacity={1 - day}>
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 137) % 1200} cy={(i * 71) % 330 + 10} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.4 + ((i * 7) % 5) / 10} />
        ))}
      </g>
      {sunS > -0.05 && sunS < 1.05 && (
        <g opacity={1 - cloudy * 0.6}>
          <circle cx={sun.x} cy={sun.y} r={70} fill="url(#sunGlow)" />
          <circle cx={sun.x} cy={sun.y} r={24} fill="#FFD24A" />
        </g>
      )}
      {moonS >= 0 && moonS <= 1 && (
        <g opacity={0.9 - cloudy * 0.5}>
          <circle cx={moon.x} cy={moon.y} r={16} fill="#EDF5F3" />
          <circle cx={moon.x + 7} cy={moon.y - 5} r={14} fill={skyTop} />
        </g>
      )}

      {/* Raios de sol até o painel */}
      {solarOn && sunS > 0 && sunS < 1 && (
        <line x1={sun.x} y1={sun.y} x2={panelCenter.x} y2={panelCenter.y} className="sunray" opacity={0.25 + solarK * 0.6} />
      )}

      {/* Nuvens */}
      {Array.from({ length: cloudsN }, (_, i) => {
        const x = ((i * 260 + drift * (0.6 + (i % 3) * 0.2)) % 1400) - 150;
        const y = 50 + ((i * 53) % 110);
        const sc = 0.8 + (i % 3) * 0.3;
        const fill = rainOn ? "#8A9CA1" : mixColor("#3C5157", "#FFFFFF", day);
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} opacity={0.88}>
            <ellipse cx={0} cy={10} rx={60} ry={18} fill={fill} />
            <ellipse cx={-22} cy={0} rx={28} ry={22} fill={fill} />
            <ellipse cx={18} cy={-6} rx={34} ry={28} fill={fill} />
          </g>
        );
      })}

      {/* Solo */}
      <path d="M0 520 Q300 495 600 515 T1200 505 L1200 600 L0 600 Z" fill="url(#ground)" />
      <rect x={0} y={560} width={1200} height={40} fill={ground2} opacity={0.6} />

      {/* ---------- Rede ---------- */}
      {model === "lorawan" ? (
        <g>
          <Building x={572} y={364} />
          <Link a={LORA.g1} b={LORA.lns} active={live === "backhaul"} dashed />
          <Link a={LORA.lns} b={LORA.app} active={live === "app" || (live === "rx" && dl)} />
          <Gateway at={LORA.g1} active={live === "uplink" || live === "backhaul"} />
          <Server at={LORA.lns} active={live === "backhaul" || live === "app"} label="LNS" />
          <Monitor at={LORA.app} flash={flash} received={!!s.received} />
          <NodeLabel x={LORA.g1.x} y={LORA.g1.y - 32} title="Gateway LoRaWAN" sub="AU915" active={live === "uplink"} />
          <NodeLabel x={LORA.lns.x} y={LORA.lns.y + 66} title="Network Server" sub="LNS" active={live === "backhaul"} />
          <NodeLabel x={LORA.app.x} y={LORA.app.y + 78} title="Plataforma" sub="aplicação do cliente" active={live === "app"} />
          <text x={(LORA.g1.x + LORA.lns.x) / 2 - 20} y={260} className="link-label">
            backhaul IP
          </text>
        </g>
      ) : (
        <g>
          <Link a={NB.towerBase} b={NB.core} active={live === "uplink" || (live === "dl" && dl)} />
          <Link a={NB.core} b={NB.broker} active={live === "broker" || (live === "dl" && dl)} />
          <Link a={NB.broker} b={NB.app} active={live === "app"} />
          <Tower top={NB.tower} active={live === "attach" || live === "uplink"} />
          <Server at={NB.core} active={live === "uplink" || live === "broker"} label="EPC" />
          <Cloud at={NB.broker} active={live === "broker" || live === "app"} />
          <Monitor at={NB.app} flash={flash} received={!!s.received} />
          <NodeLabel x={NB.tower.x} y={NB.tower.y - 48} title="ERB da operadora" sub="rede celular NB-IoT" active={live === "attach"} />
          <NodeLabel x={NB.core.x} y={NB.core.y + 66} title="Core da operadora" sub="internet" active={live === "uplink"} />
          <NodeLabel x={NB.broker.x} y={NB.broker.y - 56} title="Broker / Nuvem" sub="MQTT · MQTTs · TCP · UDP" active={live === "broker"} />
          <NodeLabel x={NB.app.x} y={NB.app.y + 78} title="Plataforma" sub="assinante do tópico" active={live === "app"} />
        </g>
      )}

      {/* ---------- Estação ---------- */}
      <g>
        {/* Poste */}
        <rect x={194} y={190} width={12} height={335} fill="#1E2B2F" />

        {/* Aquecedor */}
        {s.heater && <circle cx={200} cy={130} r={70} fill="url(#heatGlow)" className="pulse" />}

        {/* Espícula anti-pássaros */}
        {[-30, -18, -6, 6, 18, 30].map((dx) => (
          <line key={dx} x1={200 + dx * 0.6} y1={72} x2={200 + dx * 1.2} y2={42} stroke="#9AA7AA" strokeWidth={1.4} />
        ))}
        {/* Pluviômetro */}
        <rect x={164} y={68} width={72} height={14} rx={6} fill="#F4F6F6" stroke="#B9C5C8" className={hl(0.65, 0.85) ? "sensor-hl" : ""} />
        {/* Luxímetro + sensor UV + LED (topo) */}
        <path d="M189 69 A11 9 0 0 1 211 69 Z" fill="#CDE6EA" stroke={hl(0.85, 1.01) ? "var(--green)" : "#9AB"} strokeWidth={hl(0.85, 1.01) ? 3 : 1} />
        <circle cx={222} cy={75} r={2.2} fill={s.tx && live === "read" ? "var(--green)" : "#9AB"} />
        {/* Anemômetro ultrassônico */}
        {[172, 188, 212, 228].map((x) => (
          <rect key={x} x={x - 2} y={82} width={4} height={22} fill="#DDE4E5" />
        ))}
        <rect x={168} y={86} width={64} height={14} fill="none" stroke={hl(0.45, 0.65) ? "var(--green)" : "none"} strokeWidth={3} rx={3} />
        {windOn && (
          <g className="wind-in-gap">
            <line x1={172} y1={93} x2={228} y2={93} stroke="var(--teal)" strokeWidth={1.5} strokeDasharray="4 6" style={{ animationDuration: `${windDur * 2}s` }} className="flow" />
          </g>
        )}
        {/* Corpo */}
        <rect x={168} y={104} width={64} height={28} rx={6} fill="#F4F6F6" stroke="#B9C5C8" />
        {/* Abrigo do termohigrômetro */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={172 + i * 2} y={134 + i * 9} width={56 - i * 4} height={7} rx={3} fill="#F4F6F6" stroke="#B9C5C8" className={hl(0, 0.45) ? "sensor-hl" : ""} />
        ))}
        <path d="M184 180 L216 180 L210 198 L190 198 Z" fill="#E9EDEE" stroke="#B9C5C8" />

        {/* Cabo RS485 */}
        <path id="rs485" d="M194 198 C 182 210, 181 240, 181 290 S 184 350, 190 368 C 200 390, 222 398, 240 400" className={`cable${live === "read" ? " active" : ""}`} />

        {/* Painel solar */}
        <line x1={206} y1={260} x2={240} y2={260} stroke="#5E7378" strokeWidth={4} />
        <rect x={190} y={255} width={20} height={10} rx={2} fill="#8D9A9D" />
        <g transform="translate(282 252) rotate(-14) skewX(-10)">
          <rect x={-62} y={-44} width={124} height={88} fill="#1C2E4A" stroke="#C9D3D5" strokeWidth={3} />
          {Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 6 }, (_, c) => (
              <rect key={`${r}${c}`} x={-58 + c * 20} y={-40 + r * 20.5} width={18} height={18.5} fill={mixColor("#22385C", "#4C7BB0", solarK)} />
            )),
          )}
          {!solarOn && <rect x={-62} y={-44} width={124} height={88} fill="#0B1E26" opacity={0.35} />}
        </g>

        {/* Energia: painel → PWM */}
        <path d="M300 296 L300 316 L268 316 L268 340" className={`energy${solarOn ? " on" : ""}`} />

        {/* Gabinete outdoor (corte), fixado no poste com abraçadeiras */}
        <g transform={`translate(0 ${DY})`}>
        {[392, 500].map((y) => (
          <g key={y}>
            <rect x={200} y={y - 5} width={30} height={10} rx={2} fill="#8D9A9D" />
            <rect x={190} y={y - 7} width={20} height={14} rx={3} fill="none" stroke="#8D9A9D" strokeWidth={3} />
          </g>
        ))}
        <rect x={228} y={366} width={140} height={160} rx={8} fill="#DDE3E4" stroke="#9AA7AA" strokeWidth={2} />
        <rect x={234} y={372} width={128} height={148} rx={5} fill="#F7F9F9" />

        {/* Fluxos de energia */}
        <path d="M262 404 L262 482" className={`energy on${charging ? "" : " rev batt"}`} />
        <path d="M282 392 L318 392" className={`energy on${charging ? "" : " batt"}`} />
        <path d="M330 404 L330 420" className={`energy on${charging ? "" : " batt"}`} />

        {/* Controlador PWM */}
        <rect x={240} y={380} width={52} height={24} rx={3} fill="#2F3D41" />
        <text x={266} y={396} textAnchor="middle" className="box-label light">
          PWM
        </text>
        {/* Step-down */}
        <rect x={304} y={380} width={52} height={24} rx={3} fill="#5E7378" />
        <text x={330} y={396} textAnchor="middle" className="box-label light">
          Step-down
        </text>
        {/* Endpoint */}
        <rect x={240} y={420} width={116} height={50} rx={5} fill="var(--teal)" stroke={s.tx && live && live !== "backhaul" ? "var(--green)" : "var(--teal-dark)"} strokeWidth={2.5} />
        <text x={273} y={442} textAnchor="middle" className="box-label light strong">
          {ep.name}
        </text>
        <text x={273} y={456} textAnchor="middle" className="box-label light small">
          {ep.tech}
        </text>
        {/* Bateria interna de 3,6 V do endpoint */}
        <g>
          <rect x={308} y={428} width={40} height={34} rx={4} fill="#0A5A64" stroke="#EDF5F3" strokeWidth={1.2} />
          <rect x={322} y={425} width={12} height={4} rx={1} fill="#EDF5F3" />
          <text x={328} y={443} textAnchor="middle" className="box-label light small">
            bateria
          </text>
          <text x={328} y={456} textAnchor="middle" className="box-label light">
            3,6 V
          </text>
        </g>
        {/* Bateria */}
        <rect x={240} y={480} width={116} height={42} rx={5} fill="#2F3D41" stroke={charging ? "none" : "var(--orange)"} strokeWidth={3} className={charging ? "" : "pulse-soft"} />
        <g clipPath="url(#battClip)">
          <rect x={240} y={482} width={116} height={38} fill="var(--green)" opacity={0.85} />
        </g>
        <text x={298} y={505} textAnchor="middle" className="box-label light strong">
          Bateria 12 V 7 Ah
        </text>

        <line x1={356} y1={446} x2={ANT.x} y2={446} stroke="#5E7378" strokeWidth={2} />
        <line x1={ANT.x} y1={446} x2={ANT.x} y2={366} stroke="#5E7378" strokeWidth={2} />

        {/* Status do endpoint */}
        <g transform="translate(298 548)">
          <rect x={-92} y={-13} width={184} height={24} rx={12} fill="var(--navy)" opacity={0.9} />
          <circle cx={-78} cy={-1} r={4} fill={live && live !== "backhaul" ? "var(--green)" : "#9fb0b4"} className={live ? "pulse" : ""} />
          <text x={6} y={4} textAnchor="middle" className="status-text">
            {epStatus}
          </text>
        </g>
        </g>

        {/* Antena */}
        <line x1={ANT.x} y1={366 + DY} x2={ANT.x} y2={ANT.y} stroke="#E9EDEE" strokeWidth={6} strokeLinecap="round" />

        {/* BLE */}
        {s.bleUntil > 0 && (
          <g transform="translate(110 372)">
            <rect x={-16} y={-28} width={32} height={56} rx={6} fill="var(--navy)" stroke="#fff" strokeWidth={2} />
            <rect x={-11} y={-21} width={22} height={38} rx={2} fill="var(--teal)" />
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${24 + i * 12} -14 Q${34 + i * 14} 0 ${24 + i * 12} 14`} stroke="#3B82F6" strokeWidth={2.5} fill="none" className="pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
            <text y={46} textAnchor="middle" className="node-title">
              DT KONFIG
            </text>
            <text y={60} textAnchor="middle" className="node-sub">
              configuração via BLE
            </text>
          </g>
        )}
      </g>

      {/* Origem da energia */}
      <g transform="translate(386 404)" className="energy-badge">
        <rect width={178} height={44} rx={10} fill={charging ? "#FFF6D9" : "#FDEBD3"} stroke={charging ? "var(--sun)" : "var(--orange)"} strokeWidth={2} opacity={0.95} />
        <text x={12} y={18} className="eb-title">
          {charging ? "☀ Painel solar alimenta" : "🔋 Bateria alimenta o sistema"}
        </text>
        <text x={12} y={34} className="eb-sub">
          {charging ? "e carrega a bateria" : `painel sem geração (${energyReason})`}
        </text>
      </g>

      {/* Rótulos dos componentes */}
      {labels && (
        <g className="callouts">
          {[
            { x: 190, y: 64, ty: 50, t: "Luxímetro + sensor UV" },
            { x: 164, y: 75, ty: 75, t: "Pluviômetro piezoelétrico" },
            { x: 168, y: 93, ty: 100, t: "Anemômetro ultrassônico" },
            { x: 172, y: 146, ty: 142, t: "Termo-higrômetro" },
          ].map((c) => (
            <g key={c.t}>
              <line x1={152} y1={c.ty - 4} x2={c.x} y2={c.y} />
              <text x={150} y={c.ty} textAnchor="end">
                {c.t}
              </text>
            </g>
          ))}
          <g>
            <line x1={352} y1={212} x2={392} y2={190} />
            <text x={394} y={188}>Painel solar 10 W</text>
          </g>
          <g>
            <text x={380} y={262}>Antena omni</text>
          </g>
          <g>
            <line x1={228} y1={474} x2={150} y2={474} />
            <text x={146} y={470} textAnchor="end">Gabinete IK10</text>
            <text x={146} y={484} textAnchor="end" className="sub">PWM · step-down</text>
            <text x={146} y={497} textAnchor="end" className="sub">endpoint · bateria</text>
          </g>
          <g>
            <text x={150} y={316} textAnchor="end">RS485 · Modbus-RTU</text>
            <line x1={152} y1={312} x2={179} y2={312} />
          </g>
        </g>
      )}
      {labels && (
        <g>
          <text x={150} y={156} textAnchor="end" className="callout-strong">
            + barômetro
          </text>
          <text x={150} y={169} textAnchor="end" className="callout-sub">
            no escudo de radiação
          </text>
        </g>
      )}
      {s.heater && (
        <text x={200} y={30} textAnchor="middle" className="heater-label">
          Aquecedor de degelo ligado
        </text>
      )}

      {/* Chuva */}
      {rainOn && (
        <g className="rain">
          {Array.from({ length: 90 }, (_, i) => (
            <line key={i} x1={(i * 97) % 1200} y1={-20} x2={(i * 97) % 1200 - 6} y2={-2} style={{ animationDelay: `${((i * 37) % 100) / 100}s` }} />
          ))}
        </g>
      )}
      {/* Vento */}
      {windOn && (
        <g className="wind">
          {Array.from({ length: Math.min(10, Math.round(s.r.speed)) }, (_, i) => (
            <path
              key={i}
              d={`M0 ${80 + ((i * 47) % 300)} q 40 -10 80 0 t 80 0`}
              style={{ animationDuration: `${windDur * 5}s`, animationDelay: `${(i * 0.37) % 2}s` }}
            />
          ))}
        </g>
      )}

      {/* ---------- Pacotes ---------- */}
      {live === "read" && (
        <g>
          {p < 0.45 ? (
            <Packet at={along(CABLE, ease(p / 0.45))} down label="requisição" />
          ) : (
            <Packet at={along([...CABLE].reverse(), ease((p - 0.45) / 0.55))} label="9 grandezas" />
          )}
        </g>
      )}

      {model === "lorawan" && live === "uplink" && (
        <g>
          <Rings c={ANT} p={p} max={330} color="var(--teal)" />
          <Packet at={along([ANT, LORA.g1], ease(p))} />
        </g>
      )}
      {model === "lorawan" && live === "backhaul" && (
        <g>
          <Packet at={along([LORA.g1, LORA.lns], ease(p))} />
          {p > 0.7 && (
            <text x={LORA.lns.x} y={LORA.lns.y - 54} textAnchor="middle" className="badge-text">
              autenticado e decifrado ✓
            </text>
          )}
        </g>
      )}
      {model === "lorawan" && live === "app" && <Packet at={along([LORA.lns, LORA.app], ease(p))} label="payload" />}
      {model === "lorawan" && live === "rx" && (
        <g>
          {dl ? (
            <Packet at={along([LORA.app, LORA.lns, LORA.g1, ANT], ease(p))} down label="downlink" />
          ) : (
            <text x={ANT.x + 14} y={ANT.y - 6} className="badge-text">
              {p < 0.5 ? "RX1 · sem downlink" : "RX2 · sem downlink"}
            </text>
          )}
          <Rings c={ANT} p={p} max={60} color="var(--orange)" />
        </g>
      )}

      {model === "nbiot" && live === "attach" && (
        <g>
          <Rings c={ANT} p={p} max={250} color="var(--teal)" />
          <Packet at={along(p < 0.5 ? [ANT, NB.tower] : [NB.tower, ANT], ease((p % 0.5) * 2))} down={p >= 0.5} label={p < 0.5 ? "conectar" : "ok"} />
        </g>
      )}
      {model === "nbiot" && live === "uplink" && <Packet at={along([ANT, NB.tower, NB.towerBase, NB.core], ease(p))} />}
      {model === "nbiot" && live === "broker" && <Packet at={along([NB.core, NB.broker], ease(p))} label="PUBLISH" />}
      {model === "nbiot" && live === "app" && <Packet at={along([NB.broker, NB.app], ease(p))} />}
      {model === "nbiot" && live === "dl" && (
        <g>
          {dl ? (
            <Packet at={along([NB.broker, NB.core, NB.towerBase, NB.tower, ANT], ease(p))} down label="config" />
          ) : (
            <text x={ANT.x + 14} y={ANT.y - 6} className="badge-text">
              sem comandos pendentes
            </text>
          )}
        </g>
      )}

      {/* Plataforma recebeu */}
      {flash > 0 && (
        <text x={appPt.x} y={appPt.y - 58} textAnchor="middle" className="badge-text" opacity={flash}>
          leituras recebidas ✓
        </text>
      )}
    </svg>
  );
}
