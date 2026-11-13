"use client";

import dynamic from "next/dynamic";

// A simulação usa valores aleatórios e o relógio do navegador, por isso roda só no cliente.
const Simulator = dynamic(() => import("@/components/Simulator"), {
  ssr: false,
  loading: () => <div className="loading">Carregando simulação…</div>,
});

export default function Page() {
  return <Simulator />;
}
