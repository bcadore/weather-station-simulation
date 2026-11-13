import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulação · Estação Meteorológica KHOMP",
  description: "Simulação ilustrativa do funcionamento das estações meteorológicas KHOMP DTL-485 (LoRaWAN) e DTN-485 (NB-IoT).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
