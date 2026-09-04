import type { Metadata } from "next";
import { Pixelify_Sans, VT323 } from "next/font/google";
import "./globals.css";

/*
  Duas fontes, as duas com `latin-ext` — é o subset que carrega ç, ã, ê, õ.
  Fonte pixel costuma falhar exatamente aí, e uma interface em português com
  acento quebrado é pior do que uma interface sem estilo nenhum.
*/

const pixel = Pixelify_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--fonte-pixel",
  display: "swap",
});

// VT323 é o desenho do terminal DEC VT320. Para um log verde de terminal
// antigo, é a fonte que a memória das pessoas já espera.
const terminal = VT323({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--fonte-terminal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Escritório",
  description: "Uma empresa tocada por agentes de IA, em tempo real.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${terminal.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
